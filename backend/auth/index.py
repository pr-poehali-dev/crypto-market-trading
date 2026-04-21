"""
Авторизация: регистрация по email, вход по email, Google OAuth (access_token), вход как гость.
"""
import json, os, hashlib, secrets, psycopg2, urllib.request

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p91528664_crypto_market_tradin")

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def hash_pw(pw: str) -> str:
    salt = os.environ.get("JWT_SECRET", "salt")
    return hashlib.sha256(f"{salt}{pw}".encode()).hexdigest()

def gen_token() -> str:
    return secrets.token_hex(32)

def cors():
    return {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-Authorization"}

def ok(d): return {"statusCode": 200, "headers": {**cors(), "Content-Type": "application/json"}, "body": json.dumps(d, default=str)}
def err(m, c=400): return {"statusCode": c, "headers": {**cors(), "Content-Type": "application/json"}, "body": json.dumps({"error": m})}

def make_session(conn, uid, ip, ua):
    token = gen_token()
    with conn.cursor() as cur:
        cur.execute(f'INSERT INTO "{SCHEMA}".sessions (user_id,token,ip,user_agent) VALUES (%s,%s,%s,%s)', (uid, token, ip, ua))
    conn.commit()
    return token

def user_data(conn, uid):
    with conn.cursor() as cur:
        cur.execute(f'SELECT id,email,name,avatar,is_owner FROM "{SCHEMA}".users WHERE id=%s', (uid,))
        r = cur.fetchone()
        if not r: return {}
        cur.execute(f'SELECT currency,amount FROM "{SCHEMA}".balances WHERE user_id=%s', (uid,))
        bal = {x[0]: float(x[1]) for x in cur.fetchall()}
    return {"id": r[0], "email": r[1], "name": r[2], "avatar": r[3], "isOwner": r[4], "balances": bal}

def init_balance(conn, uid):
    with conn.cursor() as cur:
        cur.execute(f'SELECT id FROM "{SCHEMA}".balances WHERE user_id=%s AND currency=%s', (uid, "RUB"))
        if not cur.fetchone():
            cur.execute(f'INSERT INTO "{SCHEMA}".balances (user_id,currency,amount) VALUES (%s,%s,%s)', (uid, "RUB", 0))
            cur.execute(f'INSERT INTO "{SCHEMA}".balances (user_id,currency,amount) VALUES (%s,%s,%s)', (uid, "USDT", 0))
    conn.commit()

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}
    try:
        body = json.loads(event.get("body") or "{}")
    except:
        return err("Bad request")
    action = body.get("action", "")
    ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")
    ua = (event.get("headers") or {}).get("User-Agent", "")
    conn = get_db()
    try:
        if action == "register": return do_register(conn, body, ip, ua)
        if action == "login": return do_login(conn, body, ip, ua)
        if action == "google": return do_google(conn, body, ip, ua)
        if action == "guest": return do_guest(conn, ip, ua)
        if action == "me": return do_me(conn, event)
        if action == "logout": return do_logout(conn, event)
        return err("Unknown action")
    finally:
        conn.close()

def do_register(conn, body, ip, ua):
    email = (body.get("email") or "").strip().lower()
    pw = body.get("password") or ""
    name = (body.get("name") or "").strip()
    if not email or "@" not in email: return err("Введите корректный email")
    if len(pw) < 6: return err("Пароль минимум 6 символов")
    if not name: return err("Введите ваше имя")
    with conn.cursor() as cur:
        cur.execute(f'SELECT id FROM "{SCHEMA}".users WHERE email=%s', (email,))
        if cur.fetchone(): return err("Email уже зарегистрирован")
        cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}".users WHERE is_owner=TRUE')
        is_owner = cur.fetchone()[0] == 0
        cur.execute(f'INSERT INTO "{SCHEMA}".users (email,name,password_hash,auth_provider,is_owner) VALUES (%s,%s,%s,%s,%s) RETURNING id',
                    (email, name, hash_pw(pw), "email", is_owner))
        uid = cur.fetchone()[0]
    conn.commit()
    init_balance(conn, uid)
    token = make_session(conn, uid, ip, ua)
    return ok({"token": token, "user": user_data(conn, uid)})

def do_login(conn, body, ip, ua):
    email = (body.get("email") or "").strip().lower()
    pw = body.get("password") or ""
    if not email or not pw: return err("Введите email и пароль")
    with conn.cursor() as cur:
        cur.execute(f'SELECT id,is_blocked FROM "{SCHEMA}".users WHERE email=%s AND password_hash=%s AND auth_provider=%s',
                    (email, hash_pw(pw), "email"))
        r = cur.fetchone()
    if not r: return err("Неверный email или пароль")
    if r[1]: return err("Аккаунт заблокирован")
    token = make_session(conn, r[0], ip, ua)
    return ok({"token": token, "user": user_data(conn, r[0])})

def do_google(conn, body, ip, ua):
    access_token = body.get("access_token") or ""
    if not access_token: return err("Нет Google токена")
    try:
        req = urllib.request.Request(f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}")
        with urllib.request.urlopen(req, timeout=5) as r:
            p = json.loads(r.read())
    except:
        return err("Ошибка проверки Google")
    pid = str(p.get("id",""))
    email = (p.get("email") or "").lower()
    name = p.get("name") or email
    avatar = p.get("picture") or ""
    if not pid: return err("Нет данных Google")
    with conn.cursor() as cur:
        cur.execute(f'SELECT id,is_blocked FROM "{SCHEMA}".users WHERE auth_provider=%s AND provider_id=%s', ("google", pid))
        r = cur.fetchone()
        if r:
            if r[1]: return err("Аккаунт заблокирован")
            uid = r[0]
            cur.execute(f'UPDATE "{SCHEMA}".users SET last_login_at=NOW(),avatar=%s WHERE id=%s', (avatar, uid))
            conn.commit()
        else:
            cur.execute(f'SELECT COUNT(*) FROM "{SCHEMA}".users WHERE is_owner=TRUE')
            is_owner = cur.fetchone()[0] == 0
            cur.execute(f'INSERT INTO "{SCHEMA}".users (email,name,avatar,auth_provider,provider_id,is_owner) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id',
                        (email or None, name, avatar, "google", pid, is_owner))
            uid = cur.fetchone()[0]
            conn.commit()
            init_balance(conn, uid)
    token = make_session(conn, uid, ip, ua)
    return ok({"token": token, "user": user_data(conn, uid)})

def do_guest(conn, ip, ua):
    """Гостевой вход — создаём временного пользователя."""
    name = "Гость"
    with conn.cursor() as cur:
        cur.execute(f'INSERT INTO "{SCHEMA}".users (name,auth_provider,is_owner) VALUES (%s,%s,%s) RETURNING id',
                    (name, "guest", False))
        uid = cur.fetchone()[0]
    conn.commit()
    init_balance(conn, uid)
    token = make_session(conn, uid, ip, ua)
    return ok({"token": token, "user": user_data(conn, uid), "isGuest": True})

def do_me(conn, event):
    token = (event.get("headers") or {}).get("X-Authorization","").replace("Bearer ","")
    if not token: return err("Не авторизован", 401)
    with conn.cursor() as cur:
        cur.execute(f'SELECT user_id FROM "{SCHEMA}".sessions WHERE token=%s AND expires_at>NOW()', (token,))
        r = cur.fetchone()
    if not r: return err("Сессия истекла", 401)
    return ok({"user": user_data(conn, r[0])})

def do_logout(conn, event):
    token = (event.get("headers") or {}).get("X-Authorization","").replace("Bearer ","")
    if token:
        with conn.cursor() as cur:
            cur.execute(f'UPDATE "{SCHEMA}".sessions SET expires_at=NOW() WHERE token=%s', (token,))
        conn.commit()
    return ok({"ok": True})
