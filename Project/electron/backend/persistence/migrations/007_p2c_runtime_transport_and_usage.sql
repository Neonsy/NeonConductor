INSERT OR IGNORE INTO profiles (id, name, created_at, updated_at)
VALUES (
    'profile_local_default',
    'Local Default',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS runs_v2 (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_id TEXT NULL REFERENCES providers(id) ON DELETE SET NULL,
    model_id TEXT NULL,
    auth_method TEXT NULL CHECK (auth_method IN ('none', 'api_key', 'device_code', 'oauth_pkce', 'oauth_device')),
    started_at TEXT NULL,
    completed_at TEXT NULL,
    aborted_at TEXT NULL,
    error_code TEXT NULL,
    error_message TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO runs_v2 (
    id,
    session_id,
    profile_id,
    prompt,
    status,
    provider_id,
    model_id,
    auth_method,
    started_at,
    completed_at,
    aborted_at,
    error_code,
    error_message,
    created_at,
    updated_at
)
SELECT
    id,
    session_id,
    'profile_local_default' AS profile_id,
    prompt,
    status,
    NULL AS provider_id,
    NULL AS model_id,
    NULL AS auth_method,
    created_at AS started_at,
    CASE WHEN status = 'completed' THEN updated_at ELSE NULL END AS completed_at,
    CASE WHEN status = 'aborted' THEN updated_at ELSE NULL END AS aborted_at,
    NULL AS error_code,
    NULL AS error_message,
    created_at,
    updated_at
FROM runs;

CREATE TABLE IF NOT EXISTS sessions_v2 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    kind TEXT NOT NULL,
    workspace_fingerprint TEXT NULL,
    run_status TEXT NOT NULL,
    pending_completion_run_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO sessions_v2 (
    id,
    profile_id,
    scope,
    kind,
    workspace_fingerprint,
    run_status,
    pending_completion_run_id,
    created_at,
    updated_at
)
SELECT
    id,
    'profile_local_default' AS profile_id,
    scope,
    kind,
    workspace_fingerprint,
    run_status,
    pending_completion_run_id,
    created_at,
    updated_at
FROM sessions;

DROP TABLE sessions;
DROP TABLE runs;

ALTER TABLE sessions_v2 RENAME TO sessions;
ALTER TABLE runs_v2 RENAME TO runs;

CREATE INDEX IF NOT EXISTS idx_sessions_profile_updated_at
    ON sessions(profile_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_fingerprint
    ON sessions(workspace_fingerprint);

CREATE INDEX IF NOT EXISTS idx_runs_session_id_created_at
    ON runs(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_profile_created_at
    ON runs(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_profile_status
    ON runs(profile_id, status);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_profile_session_created_at
    ON messages(profile_id, session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_run_created_at
    ON messages(run_id, created_at ASC);

CREATE TABLE IF NOT EXISTS message_parts (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    part_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_parts_message_sequence
    ON message_parts(message_id, sequence);

CREATE INDEX IF NOT EXISTS idx_message_parts_created_at
    ON message_parts(created_at);

CREATE TABLE IF NOT EXISTS run_usage (
    run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    input_tokens INTEGER NULL,
    output_tokens INTEGER NULL,
    cached_tokens INTEGER NULL,
    reasoning_tokens INTEGER NULL,
    total_tokens INTEGER NULL,
    latency_ms INTEGER NULL,
    cost_microunits INTEGER NULL,
    billed_via TEXT NOT NULL,
    recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_usage_provider_recorded_at
    ON run_usage(provider_id, recorded_at DESC);
