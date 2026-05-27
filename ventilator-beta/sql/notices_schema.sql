-- Beta notices + What's New (latest updates) for the Natural Ventilator Selector
CREATE TABLE IF NOT EXISTS ventilator_notices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('notice','update') NOT NULL DEFAULT 'notice',
  severity ENUM('info','warning','success') NOT NULL DEFAULT 'info',
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_kind_active (kind, active),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO ventilator_notices (kind, severity, title, body, created_by) VALUES
('notice','info','Welcome to the beta',
 'Thanks for testing the Natural Ventilator Selector. Please work through the Test Scripts tab and log anything you find under Bugs & Notes. Use the area tag so we can route each report.',
 'system'),
('update','success','Beta testing workspace launched',
 'Added the in-tool Beta panel: test scripts, area-tagged bug reports, and live deploy controls. Calculator wrapped with one-login access across Moffitt Connect.',
 'system');
