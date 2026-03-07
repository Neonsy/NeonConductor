ALTER TABLE permissions ADD COLUMN command_text TEXT NULL;
ALTER TABLE permissions ADD COLUMN approval_candidates_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE permissions ADD COLUMN selected_approval_resource TEXT NULL;

UPDATE tools_catalog
SET permission_policy = 'ask'
WHERE id = 'run_command';
