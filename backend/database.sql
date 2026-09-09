-- Task Manager database schema
-- Run this once against your MySQL server if you prefer to create the
-- schema by hand instead of letting SQLAlchemy create it automatically.

CREATE DATABASE IF NOT EXISTS task_manager
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE task_manager;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(190)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  title       VARCHAR(200)  NOT NULL,
  description TEXT          NULL,
  status      ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
  priority    ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  due_date    DATE          NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  -- Indexes to keep the common filters (my tasks, by status, by due date) fast
  INDEX idx_tasks_user_id (user_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_due_date (due_date)
) ENGINE=InnoDB;
