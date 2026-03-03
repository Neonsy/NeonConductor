ALTER TABLE runs ADD COLUMN reasoning_effort TEXT NULL
    CHECK (reasoning_effort IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh'));

ALTER TABLE runs ADD COLUMN reasoning_summary TEXT NULL
    CHECK (reasoning_summary IN ('auto', 'none'));

ALTER TABLE runs ADD COLUMN reasoning_include_encrypted INTEGER NULL
    CHECK (reasoning_include_encrypted IN (0, 1));

ALTER TABLE runs ADD COLUMN cache_strategy TEXT NULL
    CHECK (cache_strategy IN ('auto', 'manual'));

ALTER TABLE runs ADD COLUMN cache_key TEXT NULL;

ALTER TABLE runs ADD COLUMN cache_applied INTEGER NULL
    CHECK (cache_applied IN (0, 1));

ALTER TABLE runs ADD COLUMN cache_skip_reason TEXT NULL;

ALTER TABLE runs ADD COLUMN transport_openai_preference TEXT NULL
    CHECK (transport_openai_preference IN ('responses', 'chat', 'auto'));

ALTER TABLE runs ADD COLUMN transport_selected TEXT NULL
    CHECK (transport_selected IN ('responses', 'chat_completions'));

ALTER TABLE runs ADD COLUMN transport_degraded_reason TEXT NULL;
