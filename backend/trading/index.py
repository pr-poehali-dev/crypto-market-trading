"""
Торговля: покупка/продажа монет, история сделок, баланс пользователя.
Все операции с реальными балансами в БД, защищены токеном сессии.
"""
import json
import os
import psycopg2
from decimal import Decimal, ROUND_DOWN

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p91528664_crypto_market_tradin")

USDT_TO_RUB = Decimal("92.5")  # курс — обновляется при необходимости

# Комиссия в %: 0 для владельца, 0.1% для обычных
FEE_RATE = Decimal("0.001")


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
    }


def ok(data: dict) -> dict:
    return {"statusCode": 200, "headers": {**cors_headers(), "Content-Type": "application/json"}, "body": json.dumps(data, default=str)}


def err(msg: str, code: int = 400) -> dict:
    return {"statusCode": code, "headers": {**cors_headers(), "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}


def get_user_from_token(conn, event) -> dict | None:
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f'''SELECT u.id, u.is_owner, u.is_blocked
                FROM "{SCHEMA}".sessions s
                JOIN "{SCHEMA}".users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > NOW()''',
            (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "is_owner": row[1], "is_blocked": row[2]}


def get_balance(conn, user_id: int, currency: str) -> Decimal:
    with conn.cursor() as cur:
        cur.execute(
            f'SELECT amount FROM "{SCHEMA}".balances WHERE user_id = %s AND currency = %s',
            (user_id, currency)
        )
        row = cur.fetchone()
    return Decimal(str(row[0])) if row else Decimal("0")


def update_balance(conn, user_id: int, currency: str, delta: Decimal):
    with conn.cursor() as cur:
        cur.execute(
            f'''INSERT INTO "{SCHEMA}".balances (user_id, currency, amount)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, currency)
                DO UPDATE SET amount = "{SCHEMA}".balances.amount + EXCLUDED.amount, updated_at = NOW()''',
            (user_id, currency, delta)
        )


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    action = body.get("action") or (event.get("queryStringParameters") or {}).get("action", "")

    conn = get_db()
    try:
        user = get_user_from_token(conn, event)
        if not user and action not in ("rates",):
            return err("Необходима авторизация", 401)
        if user and user["is_blocked"]:
            return err("Аккаунт заблокирован", 403)

        if action == "balance":
            return handle_balance(conn, user)
        elif action == "trade":
            return handle_trade(conn, user, body)
        elif action == "history":
            return handle_history(conn, user)
        elif action == "rates":
            return ok({"USDT_RUB": float(USDT_TO_RUB)})
        else:
            return err("Неизвестное действие")
    finally:
        conn.close()


def handle_balance(conn, user):
    with conn.cursor() as cur:
        cur.execute(
            f'SELECT currency, amount FROM "{SCHEMA}".balances WHERE user_id = %s',
            (user["id"],)
        )
        rows = cur.fetchall()
    balances = {r[0]: float(r[1]) for r in rows}
    return ok({"balances": balances})


def handle_trade(conn, user, body):
    """
    Покупка/продажа монеты.
    body: {action: trade, type: buy|sell, symbol: BTC, amount: float, price: float}
    При покупке: списываем USDT -> начисляем монету
    При продаже: списываем монету -> начисляем USDT
    """
    trade_type = body.get("type", "")
    symbol = (body.get("symbol") or "").upper()
    try:
        amount = Decimal(str(body.get("amount") or 0))
        price = Decimal(str(body.get("price") or 0))
    except Exception:
        return err("Неверные числовые параметры")

    if trade_type not in ("buy", "sell"):
        return err("Тип сделки: buy или sell")
    if symbol not in ("BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX"):
        return err("Монета не поддерживается")
    if amount <= 0 or price <= 0:
        return err("Сумма и цена должны быть больше 0")

    total_usdt = (amount * price).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
    fee = (Decimal("0") if user["is_owner"] else total_usdt * FEE_RATE).quantize(Decimal("0.00000001"))

    with conn.cursor() as cur:
        if trade_type == "buy":
            usdt_bal = get_balance(conn, user["id"], "USDT")
            cost = total_usdt + fee
            if usdt_bal < cost:
                return err(f"Недостаточно USDT. Нужно: {float(cost):.4f}, доступно: {float(usdt_bal):.4f}")
            update_balance(conn, user["id"], "USDT", -(total_usdt + fee))
            update_balance(conn, user["id"], symbol, amount)
        else:
            coin_bal = get_balance(conn, user["id"], symbol)
            if coin_bal < amount:
                return err(f"Недостаточно {symbol}. Доступно: {float(coin_bal):.8f}")
            update_balance(conn, user["id"], symbol, -amount)
            received = total_usdt - fee
            update_balance(conn, user["id"], "USDT", received)

        cur.execute(
            f'''INSERT INTO "{SCHEMA}".trades
                (user_id, pair, type, base_currency, quote_currency, amount, price, total, fee, status)
                VALUES (%s, %s, %s, %s, 'USDT', %s, %s, %s, %s, 'completed') RETURNING id''',
            (user["id"], f"{symbol}/USDT", trade_type, symbol,
             float(amount), float(price), float(total_usdt), float(fee))
        )
        trade_id = cur.fetchone()[0]
    conn.commit()

    # Вернуть новый баланс
    with conn.cursor() as cur:
        cur.execute(
            f'SELECT currency, amount FROM "{SCHEMA}".balances WHERE user_id = %s',
            (user["id"],)
        )
        balances = {r[0]: float(r[1]) for r in cur.fetchall()}

    return ok({
        "ok": True,
        "tradeId": trade_id,
        "balances": balances,
        "fee": float(fee),
        "message": f"{'Куплено' if trade_type == 'buy' else 'Продано'} {float(amount)} {symbol} по ${float(price)}"
    })


def handle_history(conn, user):
    with conn.cursor() as cur:
        cur.execute(
            f'''SELECT id, pair, type, amount, price, total, fee, status, created_at
                FROM "{SCHEMA}".trades
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 50''',
            (user["id"],)
        )
        rows = cur.fetchall()

    trades = [
        {
            "id": r[0],
            "pair": r[1],
            "type": r[2],
            "amount": float(r[3]),
            "price": float(r[4]),
            "total": float(r[5]),
            "fee": float(r[6]),
            "status": r[7],
            "date": str(r[8]),
        }
        for r in rows
    ]
    return ok({"trades": trades})
