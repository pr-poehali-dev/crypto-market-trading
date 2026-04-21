"""
Рынок: реальные цены с CoinGecko API. Кэш 30 сек, чтобы не прыгало.
"""
import json, os, urllib.request, time

_cache = {"data": None, "ts": 0}
CACHE_TTL = 30

COINS = [
    {"id":"bitcoin","symbol":"BTC","name":"Bitcoin","color":"#f59e0b"},
    {"id":"ethereum","symbol":"ETH","name":"Ethereum","color":"#8b5cf6"},
    {"id":"binancecoin","symbol":"BNB","name":"BNB","color":"#eab308"},
    {"id":"solana","symbol":"SOL","name":"Solana","color":"#22c55e"},
    {"id":"ripple","symbol":"XRP","name":"XRP","color":"#3b82f6"},
    {"id":"cardano","symbol":"ADA","name":"Cardano","color":"#60a5fa"},
    {"id":"dogecoin","symbol":"DOGE","name":"Dogecoin","color":"#ca8a04"},
    {"id":"avalanche-2","symbol":"AVAX","name":"Avalanche","color":"#ef4444"},
]

def fmt_large(n):
    if n>=1e12: return f"${n/1e12:.2f}T"
    if n>=1e9: return f"${n/1e9:.1f}B"
    if n>=1e6: return f"${n/1e6:.0f}M"
    return f"${n:,.0f}"

def cors():
    return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type"}

def fetch():
    ids = ",".join(c["id"] for c in COINS)
    url = f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h"
    req = urllib.request.Request(url, headers={"User-Agent":"CryptoX/1.0"})
    with urllib.request.urlopen(req, timeout=8) as r:
        raw = json.loads(r.read())
    by_id = {x["id"]: x for x in raw}
    result = []
    for c in COINS:
        item = by_id.get(c["id"])
        if not item: continue
        result.append({
            "id": c["id"], "symbol": c["symbol"], "name": c["name"], "color": c["color"],
            "price": item.get("current_price") or 0,
            "change": round(item.get("price_change_percentage_24h") or 0, 2),
            "volume": fmt_large(item.get("total_volume") or 0),
            "cap": fmt_large(item.get("market_cap") or 0),
            "high24h": item.get("high_24h") or 0,
            "low24h": item.get("low_24h") or 0,
        })
    return result

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":cors(),"body":""}
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL:
        coins = _cache["data"]
    else:
        try:
            coins = fetch()
            _cache["data"] = coins
            _cache["ts"] = now
        except Exception as e:
            if _cache["data"]:
                coins = _cache["data"]
            else:
                return {"statusCode":503,"headers":{**cors(),"Content-Type":"application/json"},"body":json.dumps({"error":str(e)})}
    return {"statusCode":200,"headers":{**cors(),"Content-Type":"application/json"},"body":json.dumps({"coins":coins,"ts":int(now)})}
