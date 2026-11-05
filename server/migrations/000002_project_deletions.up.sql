CREATE TABLE IF NOT EXISTS project_deletions (
 id VARCHAR(64) PRIMARY KEY,
 project_id VARCHAR(64) NOT NULL,
 owner_id VARCHAR(64) NOT NULL,
 actor_id VARCHAR(64) NOT NULL,
 title VARCHAR(200) NULL,
 width INT NULL,
 height INT NULL,
 deleted_at DATETIME(6) NULL,
 state ENUM('pending','running','retry_wait','completed') NOT NULL DEFAULT 'pending',
 safe_error_code VARCHAR(64) NULL,
 internal_error VARCHAR(500) NULL,
 attempts INT NOT NULL DEFAULT 0,
 next_attempt_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 lease_token VARCHAR(64) NULL,
 lease_until DATETIME(6) NULL,
 completed_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY deletion_project(project_id),
 INDEX deletion_due(state,next_attempt_at),
 INDEX deletion_owner(owner_id,state,created_at,id),
 FOREIGN KEY(owner_id) REFERENCES users(id),
 FOREIGN KEY(actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS project_deletion_assets (
 task_id VARCHAR(64) NOT NULL,
 asset_id VARCHAR(64) NOT NULL,
 asset_version BIGINT UNSIGNED NOT NULL,
 original_key VARCHAR(512) NOT NULL DEFAULT '',
 normalized_key VARCHAR(512) NOT NULL DEFAULT '',
 preview_key VARCHAR(512) NOT NULL DEFAULT '',
 state ENUM('pending','preserved','retired') NOT NULL DEFAULT 'pending',
 PRIMARY KEY(task_id,asset_id,asset_version),
 FOREIGN KEY(task_id) REFERENCES project_deletions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS project_deletion_files (
 task_id VARCHAR(64) NOT NULL,
 file_key VARCHAR(512) NOT NULL,
 state ENUM('pending','completed') NOT NULL DEFAULT 'pending',
 source VARCHAR(32) NOT NULL,
 internal_error VARCHAR(500) NULL,
 attempts INT NOT NULL DEFAULT 0,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 PRIMARY KEY(task_id,file_key),
 FOREIGN KEY(task_id) REFERENCES project_deletions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
