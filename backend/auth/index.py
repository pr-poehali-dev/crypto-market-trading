"""
Авторизация: регистрация, вход по почте, Google OAuth, VK OAuth.
Возвращает токен сессии при успехе.
"""
import json
import os
import hashlib
import secrets
import psycopg2
import urllib.request
import urllib.parse
from datetime import datetime, timezone

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p91528664_crypto_market_tradin")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    salt = os.environ.get("JWT_SECRET", "fallback-salt")
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def generate_token() -> str:
    return secrets.token_hex(32)


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


def create_session(conn, user_id: int, ip: str, ua: str) -> str:
    token = generate_token()
    with conn.cursor() as cur:
        cur.execute(
            f'INSERT INTO "{SCHEMA}".sessions (user_id, token, ip, user_agent) VALUES (%s, %s, %s, %s)',
            (user_id, token, ip, ua)
        )
    conn.commit()
    return token


def get_user_data(conn, user_id: int) -> dict:
    with conn.cursor() as cur:
        cur.execute(f'SELECT id, email, name, avatar, is_owner, created_at FROM "{SCHEMA}".users WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if not row:
            return {}
        uid, email, name, avatar, is_owner, created_at = row
        cur.execute(f'SELECT currency, amount FROM "{SCHEMA}".balances WHERE user_id = %s', (uid,))
        balances = {r[0]: float(r[1]) for r in cur.fetchall()}
    return {
        "id": uid,
        "email": email,
        "name": name,
        "avatar": avatar,
        "isOwner": is_owner,
        "createdAt": str(created_at),
        "balances": balances,
    }


def ensure_initial_balance(conn, user_id: int, is_owner: bool):
    """Новому пользователю — стартовые 1000 руб (владелец — бесплатно)."""
    with conn.cursor() as cur:
        cur.execute(f'SELECT id FROM "{SCHEMA}".balances WHERE user_id = %s AND currency = %s', (user_id, "RUB"))
        if not cur.fetchone():
            initial = 0  # реальный баланс 0 — пополняется через депозит
            cur.execute(
                f'INSERT INTO "{SCHEMA}".balances (user_id, currency, amount) VALUES (%s, %s, %s)',
                (user_id, "RUB", initial)
            )
            cur.execute(
                f'INSERT INTO "{SCHEMA}".balances (user_id, currency, amount) VALUES (%s, %s, %s)',
                (user_id, "USDT", 0)
            )
    conn.commit()


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return err("Неверный формат запроса")

    action = body.get("action", "")
    ip = event.get("requestContext", {}).get("identity", {}).get("sourceIp", "")
    ua = (event.get("headers") or {}).get("User-Agent", "")

    conn = get_db()
    try:
        if action == "register":
            return handle_register(conn, body, ip, ua)
        elif action == "login":
            return handle_login(conn, body, ip, ua)
        elif action == "oauth_google":
            return handle_google(conn, body, ip, ua)
        elif action == "oauth_vk":
            return handle_vk(conn, body, ip, ua)
        elif action == "me":
            return handle_me(conn, event)
        elif action == "logout":
            return handle_logout(conn, event)
        else:
            return err("Неизвестное действие")
    finally:
        conn.close()


def handle_register(conn, body, ip, ua):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    name = (body.get("name") or "").strip()

    if not email or "@" not in email:
        return err("Введите корректный email")
    if len(password) < 6:
        return err("Пароль минимум 6 символов")
    if not name:
        return err("Введите ваше имя")

    pw_hash = hash_password(password)

    with conn.cursor() as cur:
        cur.execute(f'SELECT id FROM "{SCHEMA}".users WHERE email = %s', (email,))
        if cur.fetchone():
            return err("Email уже зарегистрирован")

        # Первый пользователь или владелец по email
        cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}".users')
        count = cur.fetchone()[0]
        is_owner = (count == 0) or (OWNER_EMAIL and email == OWNER_EMAIL.lower())

        cur.execute(
            f'''INSERT INTO "{SCHEMA}".users (email, name, password_hash, auth_provider, is_owner, is_verified)
                VALUES (%s, %s, %s, 'email', %s, TRUE) RETURNING id''',
            (email, name, pw_hash, is_owner)
        )
        user_id = cur.fetchone()[0]
    conn.commit()

    ensure_initial_balance(conn, user_id, is_owner)
    token = create_session(conn, user_id, ip, ua)
    user = get_user_data(conn, user_id)
    return ok({"token": token, "user": user})


def handle_login(conn, body, ip, ua):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return err("Введите email и пароль")

    pw_hash = hash_password(password)

    with conn.cursor() as cur:
        cur.execute(
            f'SELECT id, is_blocked FROM "{SCHEMA}".users WHERE email = %s AND auth_provider = \'email\' AND password_hash = %s',
            (email, pw_hash)
        )
        row = cur.fetchone()

    if not row:
        return err("Неверный email или пароль")
    user_id, is_blocked = row
    if is_blocked:
        return err("Аккаунт заблокирован. Обратитесь в поддержку.")

    with conn.cursor() as cur:
        cur.execute(f'UPDATE "{SCHEMA}".users SET last_login_at = NOW() WHERE id = %s', (user_id,))
    conn.commit()

    token = create_session(conn, user_id, ip, ua)
    user = get_user_data(conn, user_id)
    return ok({"token": token, "user": user})


def handle_google(conn, body, ip, ua):
    """Google OAuth — получаем access_token, запрашиваем профиль."""
    access_token = body.get("access_token") or ""
    if not access_token:
        return err("Нет токена Google")

    try:
        req = urllib.request.Request(
            f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            profile = json.loads(resp.read())
    except Exception:
        return err("Ошибка проверки Google токена")

    provider_id = str(profile.get("id", ""))
    email = (profile.get("email") or "").lower()
    name = profile.get("name") or profile.get("given_name") or email
    avatar = profile.get("picture") or ""

    if not provider_id:
        return err("Не удалось получить данные Google")

    return _oauth_upsert(conn, "google", provider_id, email, name, avatar, ip, ua)


def handle_vk(conn, body, ip, ua):
    """VK ID OAuth — получаем access_token."""
    access_token = body.get("access_token") or ""
    if not access_token:
        return err("Нет токена VK")

    try:
        params = urllib.parse.urlencode({"access_token": access_token, "v": "5.199", "fields": "photo_200"})
        req = urllib.request.Request(f"https://api.vk.com/method/users.get?{params}")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        profile = data["response"][0]
    except Exception:
        return err("Ошибка проверки VK токена")

    provider_id = str(profile.get("id", ""))
    name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip() or "VK Пользователь"
    avatar = profile.get("photo_200") or ""
    email = body.get("email") or ""

    if not provider_id:
        return err("Не удалось получить данные VK")

    return _oauth_upsert(conn, "vk", provider_id, email, name, avatar, ip, ua)


def _oauth_upsert(conn, provider, provider_id, email, name, avatar, ip, ua):
    with conn.cursor() as cur:
        cur.execute(
            f'SELECT id, is_blocked FROM "{SCHEMA}".users WHERE auth_provider = %s AND provider_id = %s',
            (provider, provider_id)
        )
        row = cur.fetchone()

        if row:
            user_id, is_blocked = row
            if is_blocked:
                return err("Аккаунт заблокирован.")
            cur.execute(
                f'UPDATE "{SCHEMA}".users SET last_login_at = NOW(), avatar = %s WHERE id = %s',
                (avatar, user_id)
            )
            conn.commit()
        else:
            cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}".users')
            count = cur.fetchone()[0]
            is_owner = count == 0

            cur.execute(
                f'''INSERT INTO "{SCHEMA}".users (email, name, avatar, auth_provider, provider_id, is_owner, is_verified)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE) RETURNING id''',
                (email or None, name, avatar, provider, provider_id, is_owner)
            )
            user_id = cur.fetchone()[0]
            conn.commit()
            ensure_initial_balance(conn, user_id, is_owner)

    token = create_session(conn, user_id, ip, ua)
    user = get_user_data(conn, user_id)
    return ok({"token": token, "user": user})


def handle_me(conn, event):
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")
    if not token:
        return err("Не авторизован", 401)

    with conn.cursor() as cur:
        cur.execute(
            f'SELECT user_id FROM "{SCHEMA}".sessions WHERE token = %s AND expires_at > NOW()',
            (token,)
        )
        row = cur.fetchone()

    if not row:
        return err("Сессия истекла", 401)

    user = get_user_data(conn, row[0])
    return ok({"user": user})


def handle_logout(conn, event):
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")
    if token:
        with conn.cursor() as cur:
            cur.execute(f'UPDATE "{SCHEMA}".sessions SET expires_at = NOW() WHERE token = %s', (token,))
        conn.commit()
    return ok({"ok": True})
