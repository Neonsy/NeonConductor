ALTER TABLE permissions ADD COLUMN profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE permissions ADD COLUMN tool_id TEXT NOT NULL DEFAULT '';
ALTER TABLE permissions ADD COLUMN workspace_fingerprint TEXT NULL;
ALTER TABLE permissions ADD COLUMN scope_kind TEXT NOT NULL DEFAULT 'tool';
ALTER TABLE permissions ADD COLUMN summary_json TEXT NOT NULL DEFAULT '{"title":"Permission Request","detail":"This action requires approval."}';
ALTER TABLE permissions ADD COLUMN resolved_scope TEXT NULL;
ALTER TABLE permissions ADD COLUMN consumed_at TEXT NULL;

UPDATE permissions
SET
    profile_id = (
        SELECT id
        FROM profiles
        WHERE is_active = 1
        ORDER BY updated_at DESC, id ASC
        LIMIT 1
    )
WHERE profile_id IS NULL;

UPDATE permissions
SET tool_id = CASE
    WHEN resource LIKE 'tool:%' THEN substr(resource, 6, instr(substr(resource, 6), ':') - 1)
    ELSE ''
END
WHERE tool_id = '';

UPDATE permissions
SET tool_id = CASE
    WHEN tool_id = '' AND resource LIKE 'tool:%' THEN substr(resource, 6)
    ELSE tool_id
END
WHERE tool_id = '';

CREATE INDEX idx_permissions_profile_decision_created_at ON permissions(profile_id, decision, created_at);
CREATE INDEX idx_permissions_resource_workspace_decision ON permissions(resource, workspace_fingerprint, decision);

CREATE TABLE workspace_roots (
    fingerprint TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    absolute_path TEXT NOT NULL,
    path_key TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_workspace_roots_profile_path_key ON workspace_roots(profile_id, path_key);
CREATE INDEX idx_workspace_roots_profile_updated_at ON workspace_roots(profile_id, updated_at DESC);
