ALTER TABLE provider_model_catalog ADD COLUMN supports_vision INTEGER NULL
    CHECK (supports_vision IN (0, 1));

ALTER TABLE provider_model_catalog ADD COLUMN supports_audio_input INTEGER NULL
    CHECK (supports_audio_input IN (0, 1));

ALTER TABLE provider_model_catalog ADD COLUMN supports_audio_output INTEGER NULL
    CHECK (supports_audio_output IN (0, 1));

ALTER TABLE provider_model_catalog ADD COLUMN input_modalities_json TEXT NULL;

ALTER TABLE provider_model_catalog ADD COLUMN output_modalities_json TEXT NULL;

ALTER TABLE provider_model_catalog ADD COLUMN prompt_family TEXT NULL;
