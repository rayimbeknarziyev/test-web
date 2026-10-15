CREATE DATABASE IF NOT EXISTS testflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE testflow_db;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rate_limits (
  key_hash CHAR(40) NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  window_start DATETIME NOT NULL,
  PRIMARY KEY (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  subject VARCHAR(100) NULL,
  description TEXT NULL,
  source_filename VARCHAR(255) NULL,
  current_version INT UNSIGNED NOT NULL DEFAULT 1,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_tests_user (user_id, deleted_at, created_at),
  KEY idx_tests_subject (user_id, subject),
  CONSTRAINT fk_tests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_id BIGINT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_test_version (test_id, version_number),
  CONSTRAINT fk_versions_test FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_version_id BIGINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NULL,
  position INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_questions_version (test_version_id, position),
  CONSTRAINT fk_questions_version FOREIGN KEY (test_version_id) REFERENCES test_versions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE question_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id BIGINT UNSIGNED NOT NULL,
  option_text TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  position TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_options_question (question_id, position),
  CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  test_id BIGINT UNSIGNED NOT NULL,
  test_version_id BIGINT UNSIGNED NOT NULL,
  mode ENUM('practice','exam') NOT NULL,
  source ENUM('test','mistakes','bookmarks') NOT NULL DEFAULT 'test',
  status ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  total_questions INT UNSIGNED NOT NULL,
  correct_count INT UNSIGNED NULL,
  incorrect_count INT UNSIGNED NULL,
  unanswered_count INT UNSIGNED NULL,
  score INT UNSIGNED NULL,
  percentage TINYINT UNSIGNED NULL,
  question_order_json JSON NULL,
  current_question_index INT UNSIGNED NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_attempts_user_status (user_id, status, started_at),
  KEY idx_attempts_user_test (user_id, test_id),
  KEY idx_attempts_completed (user_id, completed_at),
  CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempts_test FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE RESTRICT,
  CONSTRAINT fk_attempts_version FOREIGN KEY (test_version_id) REFERENCES test_versions (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attempt_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  question_order INT UNSIGNED NOT NULL,
  selected_option_id BIGINT UNSIGNED NULL,
  is_correct TINYINT(1) NULL,
  answered_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attempt_question (attempt_id, question_id),
  UNIQUE KEY uq_attempt_order (attempt_id, question_order),
  KEY idx_aq_question (question_id, is_correct),
  KEY idx_aq_answered (answered_at),
  CONSTRAINT fk_aq_attempt FOREIGN KEY (attempt_id) REFERENCES attempts (id) ON DELETE CASCADE,
  CONSTRAINT fk_aq_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_aq_option FOREIGN KEY (selected_option_id) REFERENCES question_options (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attempt_question_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attempt_question_id BIGINT UNSIGNED NOT NULL,
  option_id BIGINT UNSIGNED NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_aqo_option (attempt_question_id, option_id),
  UNIQUE KEY uq_aqo_order (attempt_question_id, display_order),
  CONSTRAINT fk_aqo_aq FOREIGN KEY (attempt_question_id) REFERENCES attempt_questions (id) ON DELETE CASCADE,
  CONSTRAINT fk_aqo_option FOREIGN KEY (option_id) REFERENCES question_options (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookmarks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookmark (user_id, question_id),
  KEY idx_bookmark_question (question_id),
  CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookmarks_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_activity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  activity_type VARCHAR(40) NOT NULL,
  reference_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_user (user_id, created_at),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
