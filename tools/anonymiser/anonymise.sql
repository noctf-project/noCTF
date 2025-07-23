SET session_replication_role = replica;

CREATE TABLE ip_mapping (
  id INTEGER GENERATED ALWAYS AS IDENTITY,
  original varchar unique,
  anonymised varchar GENERATED ALWAYS AS ('10.0.' || (id/256) || '.' || (id%256)) STORED
);
INSERT INTO ip_mapping (original) SELECT ip FROM "session" ON CONFLICT (original) DO NOTHING;
INSERT INTO ip_mapping (original) SELECT metadata->>'ip' FROM "submission" ON CONFLICT(original) DO NOTHING;

UPDATE session SET ip=(SELECT anonymised FROM ip_mapping WHERE ip=original);
UPDATE "user_identity" SET
  secret_data='$scrypt$N=16384,r=8,p=1$KMcU5PfZlICJrioEe8MtbQ==$FAM/KB8ZUaySkIjM+GQLM0d0BVuVkH4JLrl7UF33q/gbVOoyWZ7hKB23RnlUNRG2q5GiBftQ1IGBYkwi+kcsPQ==',
  provider_id=('email-'||user_id||'@2025.ductf.net'),
  updated_at=updated_at
  WHERE provider='email';
UPDATE "user" SET name=('redacted-name-'||id), updated_at=updated_at WHERE name LIKE '%@%.com';
UPDATE submission 
  SET metadata = jsonb_set(metadata, '{ip}', to_jsonb(ip_mapping.anonymised)),
  updated_at=updated_at
  FROM ip_mapping 
  WHERE ip_mapping.original = (submission.metadata->>'ip')
  AND ip_mapping.anonymised IS NOT NULL;
DROP TABLE ip_mapping;
DELETE FROM config WHERE namespace NOT IN ('core.setup', 'core.score');