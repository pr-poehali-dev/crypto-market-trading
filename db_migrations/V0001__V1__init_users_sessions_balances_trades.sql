
CREATE TABLE IF NOT EXISTS "t_p91528664_crypto_market_tradin".users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    provider_id TEXT,
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "t_p91528664_crypto_market_tradin".sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "t_p91528664_crypto_market_tradin".users(id),
    token TEXT NOT NULL UNIQUE,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS "t_p91528664_crypto_market_tradin".balances (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "t_p91528664_crypto_market_tradin".users(id),
    currency TEXT NOT NULL DEFAULT 'RUB',
    amount NUMERIC(20, 8) NOT NULL DEFAULT 0,
    locked_amount NUMERIC(20, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, currency)
);

CREATE TABLE IF NOT EXISTS "t_p91528664_crypto_market_tradin".trades (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "t_p91528664_crypto_market_tradin".users(id),
    pair TEXT NOT NULL,
    type TEXT NOT NULL,
    base_currency TEXT NOT NULL,
    quote_currency TEXT NOT NULL DEFAULT 'USDT',
    amount NUMERIC(20, 8) NOT NULL,
    price NUMERIC(20, 8) NOT NULL,
    total NUMERIC(20, 8) NOT NULL,
    fee NUMERIC(20, 8) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "t_p91528664_crypto_market_tradin".transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES "t_p91528664_crypto_market_tradin".users(id),
    type TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RUB',
    amount NUMERIC(20, 8) NOT NULL,
    fee NUMERIC(20, 8) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON "t_p91528664_crypto_market_tradin".sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON "t_p91528664_crypto_market_tradin".sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON "t_p91528664_crypto_market_tradin".balances(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON "t_p91528664_crypto_market_tradin".trades(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON "t_p91528664_crypto_market_tradin".transactions(user_id);
