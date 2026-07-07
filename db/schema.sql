CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  role ENUM('manager','editor') NOT NULL DEFAULT 'editor',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL
);

CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(240) NOT NULL DEFAULT '',
  author VARCHAR(80) NOT NULL DEFAULT '',
  creator VARCHAR(80) NOT NULL DEFAULT '',
  owner_user_id INT NOT NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  published_at INT NOT NULL,
  updated_at INT NOT NULL,
  url VARCHAR(255) NOT NULL,
  INDEX(owner_user_id),
  CONSTRAINT fk_projects_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  attempted_at INT NOT NULL,
  INDEX idx_attempts_email (email, attempted_at),
  INDEX idx_attempts_ip (ip, attempted_at)
);

CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at INT NOT NULL,
  used_at INT DEFAULT NULL,
  created_at INT NOT NULL,
  INDEX(user_id),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
