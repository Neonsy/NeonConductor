CREATE TABLE session_attached_skills (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    asset_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (session_id, asset_key)
);

CREATE INDEX idx_session_attached_skills_profile_session
    ON session_attached_skills(profile_id, session_id, created_at);
