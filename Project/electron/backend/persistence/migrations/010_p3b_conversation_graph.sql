INSERT OR IGNORE INTO profiles (id, name, created_at, updated_at)
VALUES (
    'profile_local_default',
    'Local Default',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS conversations_v3 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('detached', 'workspace')),
    workspace_fingerprint TEXT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_profile_scope_workspace
    ON conversations_v3(profile_id, scope, ifnull(workspace_fingerprint, ''));

CREATE INDEX IF NOT EXISTS idx_conversations_profile_scope_updated_at
    ON conversations_v3(profile_id, scope, updated_at DESC);

CREATE TABLE IF NOT EXISTS threads_v3 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations_v3(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_profile_conversation_updated_at
    ON threads_v3(profile_id, conversation_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS tags_v3 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_profile_label
    ON tags_v3(profile_id, label);

CREATE TABLE IF NOT EXISTS thread_tags_v3 (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES threads_v3(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags_v3(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, thread_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_tags_profile_thread
    ON thread_tags_v3(profile_id, thread_id);

CREATE INDEX IF NOT EXISTS idx_thread_tags_profile_tag
    ON thread_tags_v3(profile_id, tag_id);

CREATE TABLE IF NOT EXISTS sessions_v3 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL REFERENCES conversations_v3(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES threads_v3(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('local', 'worktree', 'cloud')),
    run_status TEXT NOT NULL CHECK (run_status IN ('idle', 'running', 'completed', 'aborted', 'error')),
    pending_completion_run_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_profile_thread_updated_at
    ON sessions_v3(profile_id, thread_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_profile_conversation_updated_at
    ON sessions_v3(profile_id, conversation_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS diffs_v3 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions_v3(id) ON DELETE CASCADE,
    run_id TEXT NULL REFERENCES runs_v3(id) ON DELETE SET NULL,
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diffs_profile_session_created_at
    ON diffs_v3(profile_id, session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS runs_v3 (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions_v3(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_id TEXT NULL REFERENCES providers(id) ON DELETE SET NULL,
    model_id TEXT NULL,
    auth_method TEXT NULL CHECK (auth_method IN ('none', 'api_key', 'device_code', 'oauth_pkce', 'oauth_device')),
    reasoning_effort TEXT NULL CHECK (reasoning_effort IN ('none', 'minimal', 'low', 'medium', 'high', 'xhigh')),
    reasoning_summary TEXT NULL CHECK (reasoning_summary IN ('auto', 'none')),
    reasoning_include_encrypted INTEGER NULL CHECK (reasoning_include_encrypted IN (0, 1)),
    cache_strategy TEXT NULL CHECK (cache_strategy IN ('auto', 'manual')),
    cache_key TEXT NULL,
    cache_applied INTEGER NULL CHECK (cache_applied IN (0, 1)),
    cache_skip_reason TEXT NULL,
    transport_openai_preference TEXT NULL CHECK (transport_openai_preference IN ('responses', 'chat', 'auto')),
    transport_selected TEXT NULL CHECK (transport_selected IN ('responses', 'chat_completions')),
    transport_degraded_reason TEXT NULL,
    started_at TEXT NULL,
    completed_at TEXT NULL,
    aborted_at TEXT NULL,
    error_code TEXT NULL,
    error_message TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages_v3 (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions_v3(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL REFERENCES runs_v3(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS message_parts_v3 (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages_v3(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    part_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_usage_v3 (
    run_id TEXT PRIMARY KEY REFERENCES runs_v3(id) ON DELETE CASCADE,
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

DROP TABLE IF EXISTS thread_tags;
DROP TABLE IF EXISTS diffs;
DROP TABLE IF EXISTS message_parts;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS run_usage;
DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS threads;
DROP TABLE IF EXISTS conversations;

ALTER TABLE conversations_v3 RENAME TO conversations;
ALTER TABLE threads_v3 RENAME TO threads;
ALTER TABLE tags_v3 RENAME TO tags;
ALTER TABLE thread_tags_v3 RENAME TO thread_tags;
ALTER TABLE sessions_v3 RENAME TO sessions;
ALTER TABLE diffs_v3 RENAME TO diffs;
ALTER TABLE runs_v3 RENAME TO runs;
ALTER TABLE messages_v3 RENAME TO messages;
ALTER TABLE message_parts_v3 RENAME TO message_parts;
ALTER TABLE run_usage_v3 RENAME TO run_usage;

CREATE INDEX IF NOT EXISTS idx_runs_session_id_created_at
    ON runs(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_profile_created_at
    ON runs(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_profile_status
    ON runs(profile_id, status);

CREATE INDEX IF NOT EXISTS idx_messages_profile_session_created_at
    ON messages(profile_id, session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_run_created_at
    ON messages(run_id, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_parts_message_sequence
    ON message_parts(message_id, sequence);

CREATE INDEX IF NOT EXISTS idx_message_parts_created_at
    ON message_parts(created_at);

CREATE INDEX IF NOT EXISTS idx_run_usage_provider_recorded_at
    ON run_usage(provider_id, recorded_at DESC);

PRAGMA foreign_keys = ON;
