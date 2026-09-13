-- Named virtual vintages: Pythh_1 (locked first book) and Pythh_2 (open second book).
ALTER TABLE virtual_portfolio
  ADD COLUMN IF NOT EXISTS fund_key TEXT NOT NULL DEFAULT 'pythh_1';

UPDATE virtual_portfolio SET fund_key = 'pythh_1' WHERE fund_key IS NULL OR fund_key = '';

CREATE INDEX IF NOT EXISTS vp_fund_key_idx ON virtual_portfolio(fund_key);

COMMENT ON COLUMN virtual_portfolio.fund_key IS
  'Vintage key: pythh_1 (locked first book) or pythh_2 (open second book).';
