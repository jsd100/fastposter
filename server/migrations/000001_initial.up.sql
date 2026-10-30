CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(64) PRIMARY KEY,
 username VARCHAR(64) NOT NULL,
 username_normalized VARCHAR(64) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('user','admin') NOT NULL DEFAULT 'user',
 disabled BOOLEAN NOT NULL DEFAULT FALSE,
 must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sessions (
 id VARCHAR(64) PRIMARY KEY,
 user_id VARCHAR(64) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX sessions_user(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS password_reset_tokens (
 id VARCHAR(64) PRIMARY KEY,
 user_id VARCHAR(64) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at DATETIME(6) NOT NULL,
 used BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS projects (
 id VARCHAR(64) PRIMARY KEY,
 owner_id VARCHAR(64) NOT NULL,
 title VARCHAR(200) NOT NULL,
 document JSON NOT NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 width INT NOT NULL,
 height INT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 deleted_at DATETIME(6) NULL,
 INDEX projects_owner_updated(owner_id,deleted_at,updated_at),
 FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS project_revisions (
 project_id VARCHAR(64) NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 document JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(project_id,revision),
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS assets (
 id VARCHAR(64) PRIMARY KEY,
 owner_id VARCHAR(64) NULL,
 kind VARCHAR(32) NOT NULL,
 name VARCHAR(255) NOT NULL,
 current_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX assets_owner(owner_id),
 FOREIGN KEY(owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS asset_versions (
 asset_id VARCHAR(64) NOT NULL,
 version BIGINT UNSIGNED NOT NULL,
 original_key VARCHAR(512) NOT NULL,
 normalized_key VARCHAR(512) NOT NULL,
 preview_key VARCHAR(512) NOT NULL DEFAULT '',
 mime VARCHAR(100) NOT NULL,
 width INT NOT NULL DEFAULT 0,
 height INT NOT NULL DEFAULT 0,
 original_size BIGINT UNSIGNED NOT NULL,
 normalized_size BIGINT UNSIGNED NOT NULL,
 preview_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
 original_sha256 CHAR(64) NOT NULL,
 normalized_sha256 CHAR(64) NOT NULL,
 metadata JSON NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(asset_id,version),
 FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS asset_refs (
 owner_kind VARCHAR(32) NOT NULL,
 owner_id VARCHAR(128) NOT NULL,
 asset_id VARCHAR(64) NOT NULL,
 asset_version BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(owner_kind,owner_id,asset_id,asset_version),
 INDEX refs_asset(asset_id,asset_version),
 FOREIGN KEY(asset_id,asset_version) REFERENCES asset_versions(asset_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS resources (
 id VARCHAR(64) PRIMARY KEY,
 kind VARCHAR(32) NOT NULL,
 title VARCHAR(200) NOT NULL,
 category_id VARCHAR(64) NULL,
 parent_id VARCHAR(64) NULL,
 sort_order INT NOT NULL DEFAULT 0,
 published BOOLEAN NOT NULL DEFAULT FALSE,
 current_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
 created_by VARCHAR(64) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 deleted_at DATETIME(6) NULL,
 INDEX resources_kind_published(kind,published,deleted_at,sort_order),
 INDEX resources_parent(parent_id),
 FOREIGN KEY(created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS resource_versions (
 resource_id VARCHAR(64) NOT NULL,
 version BIGINT UNSIGNED NOT NULL,
 asset_id VARCHAR(64) NULL,
 asset_version BIGINT UNSIGNED NULL,
 document JSON NULL,
 body TEXT NULL,
 metadata JSON NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(resource_id,version),
 FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE,
 FOREIGN KEY(asset_id,asset_version) REFERENCES asset_versions(asset_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS staged_uploads (
 file_key VARCHAR(512) PRIMARY KEY,
 user_id VARCHAR(64) NOT NULL,
 state ENUM('staged','claimed','complete','failed') NOT NULL DEFAULT 'staged',
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NOT NULL,
 INDEX staging_expiry(expires_at,state),
 FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS export_jobs (
 id VARCHAR(64) PRIMARY KEY,
 user_id VARCHAR(64) NOT NULL,
 project_id VARCHAR(64) NOT NULL,
 revision BIGINT UNSIGNED NOT NULL,
 snapshot JSON NOT NULL,
 renderer_version VARCHAR(64) NOT NULL,
 content_hash CHAR(64) NOT NULL,
 idempotency_key VARCHAR(128) NOT NULL,
 state ENUM('queued','running','succeeded','failed') NOT NULL DEFAULT 'queued',
 attempts INT NOT NULL DEFAULT 0,
 lease_token VARCHAR(64) NULL,
 lease_until DATETIME(6) NULL,
 available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 error_code VARCHAR(64) NULL,
 error_message VARCHAR(500) NULL,
 result_key VARCHAR(512) NULL,
 preview_key VARCHAR(512) NULL,
 result_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 expires_at DATETIME(6) NULL,
 UNIQUE KEY job_idempotency(user_id,idempotency_key),
 INDEX job_queue(state,available_at,created_at),
 INDEX job_user_state(user_id,state,lease_until),
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_audit_logs (
 id VARCHAR(64) PRIMARY KEY,
 actor_id VARCHAR(64) NOT NULL,
 action VARCHAR(64) NOT NULL,
 target_id VARCHAR(128) NOT NULL,
 result VARCHAR(32) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX audit_created(created_at),
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
