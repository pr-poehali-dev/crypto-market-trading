"""
Торговля: покупка/продажа, история, баланс. Защита токеном.
Реальные балансы списываются из БД — не казино.
"""
import json, os, psycopg2
from decimal import Decimal, ROUND_DOWN

SCHEMA = os.environ.get("MAIN_DB_SCHEMA","t_p91528664_crypto_market_tradin")
VALID_SYMBOLS = {"BTC","ETH","BNB","SOL","XRP","ADA","DOGE","AVAX"}

def get_db(): return psycopg2.connect(os.environ["DATABASE_URL"])

def cors():
    return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-Authorization"}

def ok(d): return {"statusCode":200,"headers":{**cors(),"Content-Type":"application/json"},"body":json.dumps(d,default=str)}
def err(m,c=400): return {"statusCode":c,"headers":{**cors(),"Content-Type":"application/json"},"body":json.dumps({"error":m})}

def auth(conn, event):
    token = (event.get("headers") or {}).get("X-Authorization","").replace("Bearer ","")
    if not token: return None
    with conn.cursor() as cur:
        cur.execute(f'SELECT u.id,u.is_owner FROM "{SCHEMA}".sessions s JOIN "{SCHEMA}".users u ON u.id=s.user_id WHERE s.token=%s AND s.expires_at>NOW()', (token,))
        r = cur.fetchone()
    return {"id":r[0],"is_owner":r[1]} if r else None

def get_bal(conn, uid, currency):
    with conn.cursor() as cur:
        cur.execute(f'SELECT amount FROM "{SCHEMA}".balances WHERE user_id=%s AND currency=%s', (uid, currency))
        r = cur.fetchone()
    return Decimal(str(r[0])) if r else Decimal("0")

def upd_bal(conn, uid, currency, delta):
    with conn.cursor() as cur:
        cur.execute(f'INSERT INTO "{SCHEMA}".balances (user_id,currency,amount) VALUES (%s,%s,%s) ON CONFLICT (user_id,currency) DO UPDATE SET amount="{SCHEMA}".balances.amount+EXCLUDED.amount,updated_at=NOW()',
                    (uid, currency, delta))

def all_bal(conn, uid):
    with conn.cursor() as cur:
        cur.execute(f'SELECT currency,amount FROM "{SCHEMA}".balances WHERE user_id=%s', (uid,))
        return {r[0]:float(r[1]) for r in cur.fetchall()}

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":cors(),"body":""}
    try:
        body = json.loads(event.get("body") or "{}")
    except:
        body = {}
    action = body.get("action") or (event.get("queryStringParameters") or {}).get("action","")
    conn = get_db()
    try:
        user = auth(conn, event)
        if not user: return err("Необходима авторизация", 401)
        if action == "balance": return ok({"balances": all_bal(conn, user["id"])})
        if action == "trade": return do_trade(conn, user, body)
        if action == "history": return do_history(conn, user)
        return err("Unknown action")
    finally:
        conn.close()

def do_trade(conn, user, body):
    t = body.get("type","")
    symbol = (body.get("symbol") or "").upper()
    try:
        amount = Decimal(str(body.get("amount") or 0))
        price  = Decimal(str(body.get("price") or 0))
    except:
        return err("Неверные числа")
    if t not in ("buy","sell"): return err("Тип: buy или sell")
    if symbol not in VALID_SYMBOLS: return err("Монета не поддерживается")
    if amount <= 0 or price <= 0: return err("Сумма и цена > 0")

    total = (amount * price).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
    fee = Decimal("0") if user["is_owner"] else (total * Decimal("0.001")).quantize(Decimal("0.00000001"))

    if t == "buy":
        need = total + fee
        bal = get_bal(conn, user["id"], "USDT")
        if bal < need:
            return err(f"Недостаточно USDT. Нужно {float(need):.4f}, есть {float(bal):.4f}")
        upd_bal(conn, user["id"], "USDT", -(total + fee))
        upd_bal(conn, user["id"], symbol, amount)
    else:
        bal = get_bal(conn, user["id"], symbol)
        if bal < amount:
            return err(f"Недостаточно {symbol}. Есть {float(bal):.8f}")
        upd_bal(conn, user["id"], symbol, -amount)
        upd_bal(conn, user["id"], "USDT", total - fee)

    with conn.cursor() as cur:
        cur.execute(f'INSERT INTO "{SCHEMA}".trades (user_id,pair,type,base_currency,amount,price,total,fee,status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id',
                    (user["id"], f"{symbol}/USDT", t, symbol, float(amount), float(price), float(total), float(fee), "completed"))
        tid = cur.fetchone()[0]
    conn.commit()
    return ok({"ok":True,"tradeId":tid,"balances":all_bal(conn,user["id"]),"fee":float(fee),
               "message":f"{'Куплено' if t=='buy' else 'Продано'} {float(amount)} {symbol} по ${float(price):,.2f}"})

def do_history(conn, user):
    with conn.cursor() as cur:
        cur.execute(f'SELECT id,pair,type,amount,price,total,fee,status,created_at FROM "{SCHEMA}".trades WHERE user_id=%s ORDER BY created_at DESC LIMIT 50', (user["id"],))
        rows = cur.fetchall()
    return ok({"trades":[{"id":r[0],"pair":r[1],"type":r[2],"amount":float(r[3]),"price":float(r[4]),"total":float(r[5]),"fee":float(r[6]),"status":r[7],"date":str(r[8])} for r in rows]})
