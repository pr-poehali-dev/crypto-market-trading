const URLS = {
  auth: "https://functions.poehali.dev/027d0e9d-0f69-4b13-a578-b54b9e20a3c9",
  trading: "https://functions.poehali.dev/b71c139c-e570-4af8-8486-4ede74e205a8",
  market: "https://functions.poehali.dev/714b97f7-8b98-4312-a0bb-f57c61e3f55f",
};

function getToken(): string {
  return localStorage.getItem("cx_token") || "";
}

async function post(url: string, body: object, auth = false): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = `Bearer ${getToken()}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return res.json();
}

async function get(url: string, auth = false): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (auth) headers["Authorization"] = `Bearer ${getToken()}`;
  const res = await fetch(url, { method: "GET", headers });
  return res.json();
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    post(URLS.auth, { action: "register", email, password, name }) as Promise<{ token?: string; user?: User; error?: string }>,

  login: (email: string, password: string) =>
    post(URLS.auth, { action: "login", email, password }) as Promise<{ token?: string; user?: User; error?: string }>,

  googleLogin: (access_token: string) =>
    post(URLS.auth, { action: "oauth_google", access_token }) as Promise<{ token?: string; user?: User; error?: string }>,

  vkLogin: (access_token: string, email?: string) =>
    post(URLS.auth, { action: "oauth_vk", access_token, email }) as Promise<{ token?: string; user?: User; error?: string }>,

  me: () =>
    post(URLS.auth, { action: "me" }, true) as Promise<{ user?: User; error?: string }>,

  logout: () =>
    post(URLS.auth, { action: "logout" }, true),

  // Market
  getMarket: () =>
    get(URLS.market) as Promise<{ coins?: MarketCoin[]; error?: string }>,

  // Trading
  getBalance: () =>
    post(URLS.trading, { action: "balance" }, true) as Promise<{ balances?: Record<string, number>; error?: string }>,

  trade: (type: "buy" | "sell", symbol: string, amount: number, price: number) =>
    post(URLS.trading, { action: "trade", type, symbol, amount, price }, true) as Promise<{
      ok?: boolean; tradeId?: number; balances?: Record<string, number>; fee?: number; message?: string; error?: string
    }>,

  getHistory: () =>
    post(URLS.trading, { action: "history" }, true) as Promise<{ trades?: TradeTx[]; error?: string }>,
};

export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  isOwner: boolean;
  createdAt: string;
  balances: Record<string, number>;
}

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  cap: string;
  color: string;
  high24h: number;
  low24h: number;
}

export interface TradeTx {
  id: number;
  pair: string;
  type: "buy" | "sell";
  amount: number;
  price: number;
  total: number;
  fee: number;
  status: string;
  date: string;
}
