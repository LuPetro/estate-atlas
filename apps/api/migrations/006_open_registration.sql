-- Keep the legacy tables for a reversible application rollout, but invalidate every beta code.
DELETE FROM beta_invitations;
UPDATE account_settings SET registration='open' WHERE singleton=true;
