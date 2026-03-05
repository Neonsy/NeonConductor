CREATE TABLE IF NOT EXISTS kilo_model_routing_preferences (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL CHECK (provider_id = 'kilo'),
    model_id TEXT NOT NULL,
    routing_mode TEXT NOT NULL CHECK (routing_mode IN ('dynamic', 'pinned')),
    sort TEXT NULL CHECK (sort IN ('default', 'price', 'throughput', 'latency')),
    pinned_provider_id TEXT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, provider_id, model_id),
    CHECK (
        (routing_mode = 'dynamic' AND sort IS NOT NULL AND pinned_provider_id IS NULL)
        OR
        (routing_mode = 'pinned' AND sort IS NULL AND pinned_provider_id IS NOT NULL)
    )
);
