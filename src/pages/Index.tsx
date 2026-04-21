import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import AuthPage from "@/pages/AuthPage";
import { api, User, MarketCoin, TradeTx } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────
type Page = "home" | "trade" | "portfolio" | "analytics" | "history" | "deposit" | "withdraw" | "profile";

interface Coin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change: number;
  volume: string;
  cap: string;
  color: string;
}

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
}

interface Trade {
  id: string;
  pair: string;
  type: "buy" | "sell";
  amount: string;
  price: string;
  total: string;
  date: string;
  status: "completed" | "pending" | "cancelled";
}

// ─── Data ────────────────────────────────────────────────────────────────────
const COINS: Coin[] = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", price: 67420.5, change: 2.34, volume: "$28.4B", cap: "$1.32T", color: "#f59e0b" },
  { id: "eth", name: "Ethereum", symbol: "ETH", price: 3812.8, change: -1.12, volume: "$14.2B", cap: "$458B", color: "#8b5cf6" },
  { id: "bnb", name: "BNB", symbol: "BNB", price: 612.4, change: 0.87, volume: "$2.1B", cap: "$89B", color: "#eab308" },
  { id: "sol", name: "Solana", symbol: "SOL", price: 178.3, change: 5.21, volume: "$5.8B", cap: "$82B", color: "#22c55e" },
  { id: "xrp", name: "XRP", symbol: "XRP", price: 0.624, change: -0.54, volume: "$1.9B", cap: "$35B", color: "#3b82f6" },
  { id: "ada", name: "Cardano", symbol: "ADA", price: 0.487, change: 3.14, volume: "$892M", cap: "$17B", color: "#60a5fa" },
  { id: "doge", name: "Dogecoin", symbol: "DOGE", price: 0.162, change: -2.31, volume: "$1.1B", cap: "$23B", color: "#ca8a04" },
  { id: "avax", name: "Avalanche", symbol: "AVAX", price: 38.72, change: 1.95, volume: "$678M", cap: "$16B", color: "#ef4444" },
];

const HISTORY: Trade[] = [
  { id: "1", pair: "BTC/USDT", type: "buy", amount: "0.05 BTC", price: "65,200", total: "3,260", date: "22.04.2026 14:32", status: "completed" },
  { id: "2", pair: "ETH/USDT", type: "sell", amount: "1.2 ETH", price: "3,890", total: "4,668", date: "21.04.2026 09:15", status: "completed" },
  { id: "3", pair: "SOL/USDT", type: "buy", amount: "10 SOL", price: "172.5", total: "1,725", date: "20.04.2026 18:47", status: "completed" },
  { id: "4", pair: "BNB/USDT", type: "sell", amount: "2 BNB", price: "605", total: "1,210", date: "19.04.2026 11:22", status: "pending" },
  { id: "5", pair: "XRP/USDT", type: "buy", amount: "1000 XRP", price: "0.618", total: "618", date: "18.04.2026 07:55", status: "completed" },
  { id: "6", pair: "AVAX/USDT", type: "sell", amount: "5 AVAX", price: "41.2", total: "206", date: "17.04.2026 21:10", status: "cancelled" },
];

// ─── Generate candles ─────────────────────────────────────────────────────────
function generateCandles(base: number, count = 60): Candle[] {
  const candles: Candle[] = [];
  let price = base * 0.92;
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (Math.random() - 0.48) * base * 0.025;
    const close = Math.max(open + change, base * 0.5);
    const highExtra = Math.random() * Math.abs(change) * 0.8;
    const lowExtra = Math.random() * Math.abs(change) * 0.8;
    const high = Math.max(open, close) + highExtra;
    const low = Math.min(open, close) - lowExtra;
    candles.push({ open, close, high, low });
    price = close;
  }
  return candles;
}

// ─── Candle Chart SVG ────────────────────────────────────────────────────────
function CandleChart({ coin }: { coin: Coin }) {
  const candles = generateCandles(coin.price);
  const W = 800, H = 220;
  const padT = 10, padB = 10, padL = 5, padR = 5;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const range = maxP - minP || 1;
  const cW = (W - padL - padR) / candles.length;
  const bodyW = cW * 0.55;
  const toY = (p: number) => padT + ((maxP - p) / range) * (H - padT - padB);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      {candles.map((c, i) => {
        const x = padL + i * cW + cW / 2;
        const isUp = c.close >= c.open;
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyBot - bodyTop, 1);
        const col = isUp ? "#22c55e" : "#ef4444";
        return (
          <g key={i}>
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={col} strokeWidth="1" opacity="0.8" />
            <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={col} opacity={0.85} rx="0.5" />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mini Sparkline ──────────────────────────────────────────────────────────
function Sparkline({ change }: { change: number }) {
  const points = Array.from({ length: 20 }, (_, i) => 30 - (i / 19) * change * 2 + (Math.random() - 0.5) * 10);
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const pts = points.map((p, i) => `${(i / 19) * 80},${30 - ((p - min) / range) * 25}`).join(" ");
  return (
    <svg viewBox="0 0 80 30" className="w-16 h-8">
      <polyline points={pts} fill="none" stroke={change >= 0 ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Nav config ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "home", icon: "LayoutDashboard", label: "Главная" },
  { id: "trade", icon: "CandlestickChart", label: "Торговля" },
  { id: "portfolio", icon: "PieChart", label: "Портфель" },
  { id: "analytics", icon: "TrendingUp", label: "Аналитика" },
  { id: "history", icon: "Clock", label: "История" },
  { id: "deposit", icon: "ArrowDownCircle", label: "Пополнение" },
  { id: "withdraw", icon: "ArrowUpCircle", label: "Вывод" },
  { id: "profile", icon: "User", label: "Профиль" },
] as const;

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function Index() {
  const [page, setPage] = useState<Page>("home");
  const [selectedCoin, setSelectedCoin] = useState<Coin>(COINS[0]);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(COINS.map(c => [c.id, c.price]))
  );
  const balance = { rub: 24350, usdt: 312.5 };

  useEffect(() => {
    const iv = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        const coin = COINS[Math.floor(Math.random() * COINS.length)];
        next[coin.id] = prev[coin.id] * (1 + (Math.random() - 0.5) * 0.002);
        return next;
      });
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  const fmt = (n: number, dec = 2) =>
    n >= 1
      ? n.toLocaleString("ru-RU", { minimumFractionDigits: dec, maximumFractionDigits: dec })
      : n.toFixed(4);

  const nav = (p: Page) => { setPage(p); setSidebarOpen(false); };

  return (
    <div className="min-h-screen bg-[#0a0e16] text-[#e8eaf0] flex" style={{ fontFamily: "'Golos Text', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 flex flex-col border-r border-white/5 transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: "#0d1117" }}>

        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-black" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
            CX
          </div>
          <span className="font-bold text-base tracking-tight">CryptoX</span>
          <span className="ml-auto text-[10px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-1.5 py-0.5 rounded font-mono">LIVE</span>
        </div>

        <div className="mx-3 mt-3 mb-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] text-[#6b7280] mb-1 uppercase tracking-wider">Баланс</div>
          <div className="font-mono font-bold text-[#22c55e] text-lg">{balance.rub.toLocaleString("ru-RU")} ₽</div>
          <div className="font-mono text-xs text-[#6b7280]">{balance.usdt} USDT</div>
        </div>

        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button key={item.id} onClick={() => nav(item.id as Page)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                ${page === item.id
                  ? "text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/15"
                  : "text-[#6b7280] hover:text-[#e8eaf0] hover:bg-white/3"}`}>
              <Icon name={item.icon} size={16} fallback="Circle" />
              {item.label}
              {item.id === "history" && (
                <span className="ml-auto text-[10px] bg-[#22c55e] text-black rounded-full px-1.5 py-0.5 font-bold">6</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/20 flex items-center justify-center text-[#22c55e] text-sm font-bold">А</div>
            <div>
              <div className="text-sm font-semibold">Алексей</div>
              <div className="text-[10px] text-[#6b7280]">👑 Создатель · VIP</div>
            </div>
            <div className="ml-auto w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e]" />
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-30 px-4 py-2.5 flex items-center gap-3 border-b border-white/5" style={{ background: "rgba(13,17,23,0.9)", backdropFilter: "blur(12px)" }}>
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-white/5" onClick={() => setSidebarOpen(true)}>
            <Icon name="Menu" size={20} />
          </button>
          <div className="flex-1 overflow-hidden">
            <div className="flex gap-5 animate-ticker whitespace-nowrap text-xs font-mono">
              {[...COINS, ...COINS].map((coin, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <span className="text-[#6b7280]">{coin.symbol}</span>
                  <span className="text-[#e8eaf0]">${fmt(prices[coin.id] ?? coin.price)}</span>
                  <span className={coin.change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}>
                    {coin.change >= 0 ? "+" : ""}{coin.change}%
                  </span>
                </span>
              ))}
            </div>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-white/5 relative">
            <Icon name="Bell" size={17} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-white/5">
            <Icon name="Settings" size={17} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6" key={page} style={{ animation: "fade-in 0.35s ease both" }}>
          {page === "home" && <HomePage coins={COINS} prices={prices} fmt={fmt} setPage={setPage} setSelectedCoin={setSelectedCoin} balance={balance} />}
          {page === "trade" && <TradePage coin={selectedCoin} prices={prices} coins={COINS} setSelectedCoin={setSelectedCoin} tradeType={tradeType} setTradeType={setTradeType} tradeAmount={tradeAmount} setTradeAmount={setTradeAmount} fmt={fmt} balance={balance} />}
          {page === "portfolio" && <PortfolioPage coins={COINS} prices={prices} fmt={fmt} />}
          {page === "analytics" && <AnalyticsPage coins={COINS} prices={prices} fmt={fmt} />}
          {page === "history" && <HistoryPage />}
          {page === "deposit" && <DepositPage balance={balance} />}
          {page === "withdraw" && <WithdrawPage balance={balance} />}
          {page === "profile" && <ProfilePage />}
        </main>
      </div>
    </div>
  );
}

// ─── Shared card style ────────────────────────────────────────────────────────
const card = "rounded-2xl border border-white/5 bg-[#0d1117]/80";

interface PageProps { coins: Coin[]; prices: Record<string,number>; fmt: (n:number,d?:number)=>string; setPage: (p:Page)=>void; setSelectedCoin: (c:Coin)=>void; balance: {rub:number;usdt:number}; }
// ─── HOME ─────────────────────────────────────────────────────────────────────
function HomePage({ coins, prices, fmt, setPage, setSelectedCoin, balance }: PageProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Баланс ₽", value: `${balance.rub.toLocaleString("ru-RU")} ₽`, icon: "Wallet", color: "#22c55e" },
          { label: "Баланс USDT", value: `${balance.usdt} USDT`, icon: "DollarSign", color: "#3b82f6" },
          { label: "Активы", value: "4 позиции", icon: "Layers", color: "#8b5cf6" },
          { label: "Монет", value: "8 пар", icon: "TrendingUp", color: "#f59e0b" },
        ].map((c, i) => (
          <div key={i} className={`${card} p-4`} style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[#6b7280]">{c.label}</span>
              <Icon name={c.icon} size={15} style={{ color: c.color }} fallback="Circle" />
            </div>
            <div className="font-mono font-bold text-base" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold">Крипто-рынок</h2>
          <span className="text-xs text-[#6b7280]">Топ 8 монет</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["#", "Монета", "Цена", "24ч", "Объём", "График", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] text-[#6b7280] font-normal px-4 py-3 first:pl-5 last:pr-5 text-right first:text-left" style={i === 1 ? { textAlign: "left" } : {}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coins.map((coin: Coin, i: number) => (
                <tr key={coin.id} className="border-b border-white/3 hover:bg-white/2 transition-colors group">
                  <td className="pl-5 py-3.5 text-sm text-[#6b7280]">{i + 1}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: coin.color + "22", color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                      <div>
                        <div className="font-semibold text-sm">{coin.name}</div>
                        <div className="text-[10px] text-[#6b7280]">{coin.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold">${fmt(prices[coin.id] ?? coin.price)}</td>
                  <td className={`px-4 py-3.5 text-right font-mono text-sm font-semibold ${coin.change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {coin.change >= 0 ? "▲" : "▼"} {Math.abs(coin.change)}%
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm text-[#6b7280] hidden md:table-cell">{coin.volume}</td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="flex justify-end"><Sparkline change={coin.change} /></div>
                  </td>
                  <td className="pr-5 py-3.5">
                    <button onClick={() => { setSelectedCoin(coin); setPage("trade"); }}
                      className="text-xs border px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all font-medium"
                      style={{ borderColor: "#22c55e33", color: "#22c55e", background: "#22c55e10" }}>
                      Торг.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TRADE ────────────────────────────────────────────────────────────────────
interface TradeProps { coin: Coin; prices: Record<string,number>; coins: Coin[]; setSelectedCoin:(c:Coin)=>void; tradeType:"buy"|"sell"; setTradeType:(t:"buy"|"sell")=>void; tradeAmount:string; setTradeAmount:(v:string)=>void; fmt:(n:number,d?:number)=>string; balance:{rub:number;usdt:number}; }
function TradePage({ coin, prices, coins, setSelectedCoin, tradeType, setTradeType, tradeAmount, setTradeAmount, fmt, balance }: TradeProps) {
  const price = prices[coin.id] ?? coin.price;
  const total = tradeAmount ? (parseFloat(tradeAmount) * price).toFixed(2) : "0.00";

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {coins.map((c: Coin) => (
          <button key={c.id} onClick={() => setSelectedCoin(c)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all
              ${c.id === coin.id ? "text-black border-transparent" : "bg-transparent border-white/10 text-[#6b7280] hover:text-[#e8eaf0]"}`}
            style={c.id === coin.id ? { background: "#22c55e", borderColor: "#22c55e" } : {}}>
            <span>{c.symbol}</span>
            <span className={c.change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"} style={c.id === coin.id ? { color: "rgba(0,0,0,0.6)" } : {}}>
              {c.change >= 0 ? "+" : ""}{c.change}%
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: coin.color + "22", color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                <div>
                  <div className="font-bold">{coin.name} <span className="text-[#6b7280] font-normal text-sm">/ USDT</span></div>
                  <div className="font-mono font-black text-2xl text-[#22c55e]" style={{ textShadow: "0 0 20px #22c55e66" }}>${fmt(price)}</div>
                </div>
              </div>
            </div>
            <div className={`font-bold text-xl ${coin.change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {coin.change >= 0 ? "+" : ""}{coin.change}%
            </div>
          </div>

          <div className="h-52 w-full"><CandleChart coin={coin} /></div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
            {[
              { label: "Объём 24ч", value: coin.volume },
              { label: "Кап. рынка", value: coin.cap },
              { label: "Макс. 24ч", value: `$${fmt(price * 1.034)}` },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-[10px] text-[#6b7280] uppercase tracking-wider">{s.label}</div>
                <div className="font-mono font-semibold mt-1">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-5 space-y-4`}>
          <h3 className="font-bold">Новый ордер</h3>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: "#070b10" }}>
            {(["buy", "sell"] as const).map(t => (
              <button key={t} onClick={() => setTradeType(t)}
                className={`py-2 rounded-lg text-sm font-bold transition-all`}
                style={tradeType === t
                  ? { background: t === "buy" ? "#22c55e" : "#ef4444", color: t === "buy" ? "#000" : "#fff" }
                  : { color: "#6b7280" }}>
                {t === "buy" ? "Купить" : "Продать"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5 block">Кол-во ({coin.symbol})</label>
              <input type="number" value={tradeAmount} onChange={e => setTradeAmount(e.target.value)} placeholder="0.00"
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none transition-colors"
                style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5 block">Цена USDT</label>
              <div className="rounded-lg px-3 py-2.5 text-sm font-mono text-[#6b7280]" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                ${fmt(price)}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7280] uppercase tracking-wider mb-1.5 block">Итого USDT</label>
              <div className={`rounded-lg px-3 py-2.5 text-sm font-mono font-bold`}
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", color: tradeType === "buy" ? "#22c55e" : "#ef4444" }}>
                ${total}
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#070b10" }}>
            <div className="flex justify-between text-xs">
              <span className="text-[#6b7280]">Доступно ₽</span>
              <span className="font-mono">{balance.rub.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#6b7280]">Доступно USDT</span>
              <span className="font-mono">{balance.usdt}</span>
            </div>
          </div>

          <button className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{
              background: tradeType === "buy" ? "#22c55e" : "#ef4444",
              color: tradeType === "buy" ? "#000" : "#fff",
              boxShadow: tradeType === "buy" ? "0 0 20px #22c55e33" : "0 0 20px #ef444433"
            }}>
            {tradeType === "buy" ? `Купить ${coin.symbol}` : `Продать ${coin.symbol}`}
          </button>
          <p className="text-[10px] text-[#6b7280] text-center">Мин. сумма: 1 000 ₽ · 0% комиссия</p>
        </div>
      </div>
    </div>
  );
}

// ─── PORTFOLIO ────────────────────────────────────────────────────────────────
interface BaseProps { coins: Coin[]; prices: Record<string,number>; fmt: (n:number,d?:number)=>string; }
function PortfolioPage({ coins, prices, fmt }: BaseProps) {
  const portfolio = [
    { coin: coins[0], amount: 0.05, avg: 64200 },
    { coin: coins[1], amount: 1.2, avg: 3750 },
    { coin: coins[3], amount: 10, avg: 165 },
    { coin: coins[4], amount: 1000, avg: 0.61 },
  ];
  const totalValue = portfolio.reduce((s, p) => s + p.amount * (prices[p.coin.id] ?? p.coin.price), 0);
  const totalCost = portfolio.reduce((s, p) => s + p.amount * p.avg, 0);
  const totalPnl = totalValue - totalCost;
  const totalPct = ((totalPnl / totalCost) * 100).toFixed(2);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Стоимость", value: `$${fmt(totalValue)}`, color: "#e8eaf0" },
          { label: "P&L", value: `${totalPnl >= 0 ? "+" : ""}$${fmt(Math.abs(totalPnl))}`, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" },
          { label: "Доходность", value: `${Number(totalPct) >= 0 ? "+" : ""}${totalPct}%`, color: Number(totalPct) >= 0 ? "#22c55e" : "#ef4444" },
        ].map((s, i) => (
          <div key={i} className={`${card} p-4`}>
            <div className="text-[10px] text-[#6b7280] mb-1 uppercase tracking-wider">{s.label}</div>
            <div className="font-mono font-black text-xl" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-white/5"><h2 className="font-bold">Мои позиции</h2></div>
        <div className="divide-y divide-white/3">
          {portfolio.map(({ coin, amount, avg }) => {
            const cur = prices[coin.id] ?? coin.price;
            const pnl = (cur - avg) * amount;
            const pct = ((cur - avg) / avg * 100).toFixed(2);
            return (
              <div key={coin.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/2 transition-colors">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: coin.color + "22", color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                <div className="flex-1">
                  <div className="font-semibold">{coin.name}</div>
                  <div className="text-xs text-[#6b7280]">{amount} {coin.symbol} · ср. ${avg < 1 ? avg.toFixed(4) : avg.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">${fmt(cur * amount)}</div>
                  <div className={`text-xs font-mono`} style={{ color: Number(pct) >= 0 ? "#22c55e" : "#ef4444" }}>
                    {Number(pct) >= 0 ? "+" : ""}{pct}% · {pnl >= 0 ? "+" : ""}${fmt(Math.abs(pnl))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${card} p-5`}>
        <h3 className="font-bold mb-4">Распределение</h3>
        <div className="space-y-3">
          {portfolio.map(({ coin, amount }) => {
            const val = amount * (prices[coin.id] ?? coin.price);
            const pct = (val / totalValue * 100).toFixed(1);
            return (
              <div key={coin.id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span>{coin.symbol}</span>
                  <span className="font-mono text-[#6b7280]">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: coin.color, transition: "width 0.8s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function AnalyticsPage({ coins, prices, fmt }: BaseProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-black">Аналитика рынка</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Объём 24ч", value: "$52.4B", icon: "BarChart3", color: "#22c55e" },
          { label: "Капитализация", value: "$2.08T", icon: "Globe", color: "#3b82f6" },
          { label: "Топ гейнер", value: "SOL +5.21%", icon: "TrendingUp", color: "#22c55e" },
          { label: "Топ лузер", value: "DOGE -2.31%", icon: "TrendingDown", color: "#ef4444" },
        ].map((s, i) => (
          <div key={i} className={`${card} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name={s.icon} size={15} style={{ color: s.color }} fallback="Circle" />
              <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">{s.label}</span>
            </div>
            <div className="font-mono font-black text-base" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {coins.slice(0, 4).map((coin: Coin) => (
          <div key={coin.id} className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: coin.color + "22", color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                <span className="font-semibold text-sm">{coin.symbol}/USDT</span>
              </div>
              <span className="font-mono text-sm font-bold" style={{ color: coin.change >= 0 ? "#22c55e" : "#ef4444" }}>
                {coin.change >= 0 ? "+" : ""}{coin.change}%
              </span>
            </div>
            <div className="font-mono font-bold text-lg mb-2">${fmt(prices[coin.id] ?? coin.price)}</div>
            <div className="h-28"><CandleChart coin={coin} /></div>
          </div>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <h3 className="font-bold mb-4">Тепловая карта 24ч</h3>
        <div className="grid grid-cols-4 gap-2">
          {coins.map((coin: Coin) => {
            const intensity = Math.min(Math.abs(coin.change) / 6, 1);
            const bg = coin.change >= 0 ? `rgba(34,197,94,${0.08 + intensity * 0.45})` : `rgba(239,68,68,${0.08 + intensity * 0.45})`;
            return (
              <div key={coin.id} className="rounded-xl p-3 text-center border border-white/5" style={{ background: bg }}>
                <div className="font-bold text-sm">{coin.symbol}</div>
                <div className="font-mono text-xs mt-0.5" style={{ color: coin.change >= 0 ? "#22c55e" : "#ef4444" }}>
                  {coin.change >= 0 ? "+" : ""}{coin.change}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────
function HistoryPage() {
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const filtered = filter === "all" ? HISTORY : HISTORY.filter(t => t.type === filter);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">История сделок</h1>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#0d1117" }}>
          {(["all", "buy", "sell"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all`}
              style={filter === f ? { background: "#1a2030", color: "#e8eaf0" } : { color: "#6b7280" }}>
              {f === "all" ? "Все" : f === "buy" ? "Покупки" : "Продажи"}
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="divide-y divide-white/3">
          {filtered.map(trade => (
            <div key={trade.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/2 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: trade.type === "buy" ? "#22c55e15" : "#ef444415" }}>
                <Icon name={trade.type === "buy" ? "ArrowDownLeft" : "ArrowUpRight"} size={16} fallback="Circle"
                  style={{ color: trade.type === "buy" ? "#22c55e" : "#ef4444" }} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{trade.pair}</div>
                <div className="text-xs text-[#6b7280]">{trade.date}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{trade.amount}</div>
                <div className="text-xs text-[#6b7280]">по ${trade.price}</div>
              </div>
              <div className="text-right min-w-[90px]">
                <div className="font-mono font-bold text-sm">${trade.total}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: trade.status === "completed" ? "#22c55e15" : trade.status === "pending" ? "#f59e0b15" : "#ef444415",
                    color: trade.status === "completed" ? "#22c55e" : trade.status === "pending" ? "#f59e0b" : "#ef4444"
                  }}>
                  {trade.status === "completed" ? "Выполнен" : trade.status === "pending" ? "В обработке" : "Отменён"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DEPOSIT ─────────────────────────────────────────────────────────────────
function DepositPage({ balance }: { balance: {rub:number;usdt:number} }) {
  const [method, setMethod] = useState<"card" | "crypto">("card");
  const [amount, setAmount] = useState("");

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-black">Пополнение</h1>

      <div className={`${card} p-5 flex items-center gap-4`}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#22c55e15" }}>
          <Icon name="Wallet" size={22} style={{ color: "#22c55e" }} />
        </div>
        <div>
          <div className="text-xs text-[#6b7280] mb-0.5">Текущий баланс</div>
          <div className="font-mono font-black text-xl text-[#22c55e]">{balance.rub.toLocaleString("ru-RU")} ₽</div>
        </div>
      </div>

      <div className={`${card} p-5 space-y-4`}>
        <h3 className="font-bold">Способ</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "card", label: "Банковская карта", icon: "CreditCard" },
            { id: "crypto", label: "Криптовалюта", icon: "Layers" },
          ].map(m => (
            <button key={m.id} onClick={() => setMethod(m.id as "card" | "crypto")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
              style={{
                borderColor: method === m.id ? "#22c55e55" : "rgba(255,255,255,0.06)",
                background: method === m.id ? "#22c55e10" : "transparent",
                color: method === m.id ? "#22c55e" : "#6b7280"
              }}>
              <Icon name={m.icon} size={20} fallback="Circle" />
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          ))}
        </div>

        {method === "card" && (
          <div className="space-y-3">
            <input className="w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none" placeholder="0000 0000 0000 0000"
              style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none" placeholder="MM/YY"
                style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
              <input className="rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none" placeholder="CVV" type="password"
                style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
            </div>
            <div className="p-3 rounded-xl" style={{ background: "#070b10" }}>
              <div className="text-[10px] text-[#6b7280] mb-2 uppercase tracking-wider">Поддерживаемые банки</div>
              <div className="flex flex-wrap gap-1.5">
                {["Сбер", "Т-Банк", "Альфа", "ВТБ", "Озон", "Газпром"].map(b => (
                  <span key={b} className="text-xs border border-white/8 px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.03)" }}>{b}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {method === "crypto" && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl text-center" style={{ background: "#070b10" }}>
              <div className="w-20 h-20 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <Icon name="QrCode" size={50} className="text-[#6b7280]" />
              </div>
              <div className="font-mono text-xs text-[#6b7280] break-all">TRC20: TXvKBmqpgBxGSMfJ8...d3R4</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["USDT TRC20", "BTC", "ETH"].map(n => (
                <button key={n} className="py-2 text-xs font-mono rounded-lg hover:bg-white/5 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>{n}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`${card} p-5 space-y-3`}>
        <label className="text-[10px] text-[#6b7280] uppercase tracking-wider block">Сумма (₽)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Минимум 1 000 ₽"
          className="w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none"
          style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
        <div className="flex gap-2">
          {["1000", "5000", "10000", "50000"].map(a => (
            <button key={a} onClick={() => setAmount(a)} className="flex-1 py-1.5 text-xs font-mono rounded-lg hover:bg-white/5 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {parseInt(a).toLocaleString()}
            </button>
          ))}
        </div>
        <button className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all hover:opacity-90"
          style={{ background: "#22c55e", boxShadow: "0 0 20px #22c55e33" }}>
          Пополнить счёт
        </button>
        <p className="text-[10px] text-[#6b7280] text-center">Без комиссии · Зачисление моментально</p>
      </div>
    </div>
  );
}

// ─── WITHDRAW ────────────────────────────────────────────────────────────────
function WithdrawPage({ balance }: { balance: {rub:number;usdt:number} }) {
  const [bank, setBank] = useState("sber");
  const [amount, setAmount] = useState("");

  const banks = [
    { id: "sber", name: "Сбербанк", color: "#22c55e" },
    { id: "tbank", name: "Т-Банк", color: "#f59e0b" },
    { id: "alfa", name: "Альфа", color: "#ef4444" },
    { id: "vtb", name: "ВТБ", color: "#3b82f6" },
    { id: "ozon", name: "Озон", color: "#8b5cf6" },
    { id: "gazprom", name: "Газпром", color: "#22c55e" },
  ];

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-black">Вывод средств</h1>

      <div className={`${card} p-5 flex items-center gap-4`}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#ef444415" }}>
          <Icon name="ArrowUpCircle" size={22} style={{ color: "#ef4444" }} />
        </div>
        <div className="flex-1">
          <div className="text-xs text-[#6b7280] mb-0.5">Доступно к выводу</div>
          <div className="font-mono font-black text-xl">{balance.rub.toLocaleString("ru-RU")} ₽</div>
        </div>
        <span className="text-xs text-[#22c55e] border border-[#22c55e]/20 px-2 py-1 rounded-full">Активен</span>
      </div>

      <div className={`${card} p-5 space-y-3`}>
        <h3 className="font-bold">Выберите банк</h3>
        <div className="grid grid-cols-2 gap-2">
          {banks.map(b => (
            <button key={b.id} onClick={() => setBank(b.id)}
              className="flex items-center gap-2 p-3 rounded-xl border transition-all"
              style={{
                borderColor: bank === b.id ? "#22c55e44" : "rgba(255,255,255,0.06)",
                background: bank === b.id ? "#22c55e08" : "transparent"
              }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: b.color }}>{b.name[0]}</div>
              <span className="text-sm font-medium">{b.name}</span>
              {bank === b.id && <Icon name="Check" size={13} className="ml-auto" style={{ color: "#22c55e" }} />}
            </button>
          ))}
        </div>
      </div>

      <div className={`${card} p-5 space-y-3`}>
        <h3 className="font-bold">Реквизиты</h3>
        <input className="w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none" placeholder="Номер карты"
          style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
        <input className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none" placeholder="ФИО владельца"
          style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Сумма вывода (₽)"
          className="w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none"
          style={{ background: "#070b10", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0" }} />
        <div className="flex gap-2">
          {["1000", "5000", "10000"].map(a => (
            <button key={a} onClick={() => setAmount(a)} className="flex-1 py-1.5 text-xs font-mono rounded-lg hover:bg-white/5 transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {parseInt(a).toLocaleString()}
            </button>
          ))}
        </div>

        <div className="p-3 rounded-xl space-y-1.5 text-xs" style={{ background: "#070b10" }}>
          <div className="flex justify-between"><span className="text-[#6b7280]">Сумма</span><span className="font-mono">{amount ? parseInt(amount).toLocaleString() : "0"} ₽</span></div>
          <div className="flex justify-between"><span className="text-[#6b7280]">Комиссия</span><span className="font-mono text-[#22c55e]">0 ₽</span></div>
          <div className="flex justify-between font-bold border-t border-white/5 pt-1.5 mt-1"><span>Итого</span><span className="font-mono">{amount ? parseInt(amount).toLocaleString() : "0"} ₽</span></div>
        </div>

        <button className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
          style={{ background: "#ef4444", boxShadow: "0 0 20px #ef444433" }}>
          Вывести средства
        </button>
        <p className="text-[10px] text-[#6b7280] text-center">Срок: 1–3 рабочих дня · 0% комиссия</p>
      </div>
    </div>
  );
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
function ProfilePage() {
  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-black">Профиль</h1>

      <div className={`${card} p-6`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black" style={{ background: "#22c55e20", color: "#22c55e" }}>А</div>
          <div className="flex-1">
            <div className="font-black text-xl">Алексей</div>
            <div className="text-[#6b7280] text-sm">alexey@cryptox.ru</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] border px-2 py-0.5 rounded-full font-medium" style={{ borderColor: "#f59e0b44", color: "#f59e0b", background: "#f59e0b10" }}>👑 Создатель</span>
              <span className="text-[10px] border px-2 py-0.5 rounded-full" style={{ borderColor: "#22c55e44", color: "#22c55e", background: "#22c55e10" }}>VIP</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`${card} p-5 space-y-2`}>
        <h3 className="font-bold mb-3">Привилегии создателя</h3>
        {[
          { icon: "Crown", label: "Бесплатный вход", desc: "Без комиссии за вход" },
          { icon: "Zap", label: "Бесплатный вывод", desc: "0% при выводе средств" },
          { icon: "Shield", label: "Приоритетная поддержка", desc: "Ответ до 1 часа" },
          { icon: "Star", label: "Полный доступ", desc: "Все функции без ограничений" },
        ].map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#22c55e12" }}>
              <Icon name={p.icon} size={16} style={{ color: "#22c55e" }} fallback="Circle" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">{p.label}</div>
              <div className="text-[10px] text-[#6b7280]">{p.desc}</div>
            </div>
            <Icon name="Check" size={14} style={{ color: "#22c55e" }} />
          </div>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <h3 className="font-bold mb-4">Статистика</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Всего сделок", value: "24" },
            { label: "Прибыльных", value: "18 (75%)" },
            { label: "Объём торгов", value: "$14,240" },
            { label: "Дата регистрации", value: "01.01.2026" },
          ].map((s, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-[10px] text-[#6b7280] uppercase tracking-wider">{s.label}</div>
              <div className="font-mono font-semibold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        {[
          { icon: "Bell", label: "Уведомления" },
          { icon: "Shield", label: "Безопасность" },
          { icon: "Globe", label: "Язык: Русский" },
          { icon: "HelpCircle", label: "Поддержка" },
        ].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors border-b border-white/4 last:border-0">
            <Icon name={item.icon} size={16} className="text-[#6b7280]" fallback="Circle" />
            <span className="text-sm">{item.label}</span>
            <Icon name="ChevronRight" size={14} className="text-[#6b7280] ml-auto" />
          </button>
        ))}
      </div>

      <button className="w-full py-3 rounded-xl font-medium text-sm text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/5 transition-colors">
        Выйти из аккаунта
      </button>
    </div>
  );
}