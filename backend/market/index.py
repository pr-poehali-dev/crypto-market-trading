"""
Рынок: возвращает реальные цены с CoinGecko (публичный API, без ключа).
Кэширует данные на 60 секунд, чтобы не превышать лимиты.
"""
import json
import os
import urllib.request
import time

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p91528664_crypto_market_tradin")

# Простой in-memory кэш (живёт пока функция "тёплая")
_cache: dict = {"data": None, "ts": 0}
CACHE_TTL = 60  # секунд

COINS = [
    {"id": "bitcoin",      "symbol": "BTC", "name": "Bitcoin"},
    {"id": "ethereum",     "symbol": "ETH", "name": "Ethereum"},
    {"id": "binancecoin",  "symbol": "BNB", "name": "BNB"},
    {"id": "solana",       "symbol": "SOL", "name": "Solana"},
    {"id": "ripple",       "symbol": "XRP", "name": "XRP"},
    {"id": "cardano",      "symbol": "ADA", "name": "Cardano"},
    {"id": "dogecoin",     "symbol": "DOGE", "name": "Dogecoin"},
    {"id": "avalanche-2",  "symbol": "AVAX", "name": "Avalanche"},
]

COIN_COLORS = {
    "BTC": "#f59e0b", "ETH": "#8b5cf6", "BNB": "#eab308",
    "SOL": "#22c55e", "XRP": "#3b82f6", "ADA": "#60a5fa",
    "DOGE": "#ca8a04", "AVAX": "#ef4444",
}


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
    }


def fetch_prices() -> list:
    ids = ",".join(c["id"] for c in COINS)
    url = (
        f"https://api.coingecko.com/api/v3/coins/markets"
        f"?vs_currency=usd&ids={ids}&order=market_cap_desc"
        f"&per_page=20&page=1&sparkline=false&price_change_percentage=24h"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "CryptoX/1.0"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        raw = json.loads(resp.read())

    # Строим маппинг id -> данные
    by_id = {item["id"]: item for item in raw}

    result = []
    for coin in COINS:
        item = by_id.get(coin["id"])
        if not item:
            continue
        change = round(item.get("price_change_percentage_24h") or 0, 2)
        result.append({
            "id": coin["id"],
            "symbol": coin["symbol"],
            "name": coin["name"],
            "price": item.get("current_price") or 0,
            "change": change,
            "volume": _fmt_large(item.get("total_volume") or 0),
            "cap": _fmt_large(item.get("market_cap") or 0),
            "color": COIN_COLORS.get(coin["symbol"], "#888"),
            "high24h": item.get("high_24h") or 0,
            "low24h": item.get("low_24h") or 0,
        })
    return result


def _fmt_large(n: float) -> str:
    if n >= 1_000_000_000_000:
        return f"${n/1_000_000_000_000:.2f}T"
    if n >= 1_000_000_000:
        return f"${n/1_000_000_000:.1f}B"
    if n >= 1_000_000:
        return f"${n/1_000_000:.0f}M"
    return f"${n:,.0f}"


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL:
        coins = _cache["data"]
    else:
        try:
            coins = fetch_prices()
            _cache["data"] = coins
            _cache["ts"] = now
        except Exception as e:
            # Если CoinGecko недоступен — возвращаем кэш или fallback
            if _cache["data"]:
                coins = _cache["data"]
            else:
                return {
                    "statusCode": 503,
                    "headers": {**cors_headers(), "Content-Type": "application/json"},
                    "body": json.dumps({"error": f"Рынок временно недоступен: {str(e)}"})
                }

    return {
        "statusCode": 200,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps({"coins": coins, "cached": _cache["ts"] > 0, "ts": int(now)})
    }
