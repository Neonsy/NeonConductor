ALTER TABLE kilo_account_snapshots
    ADD COLUMN balance_amount REAL NULL;

ALTER TABLE kilo_account_snapshots
    ADD COLUMN balance_currency TEXT NULL;

ALTER TABLE kilo_account_snapshots
    ADD COLUMN balance_updated_at TEXT NULL;
