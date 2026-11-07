CREATE DATABASE IF NOT EXISTS nongtrai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS nongtrai_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'nongtrai'@'%' IDENTIFIED BY 'dev';
GRANT ALL PRIVILEGES ON nongtrai.* TO 'nongtrai'@'%';
GRANT ALL PRIVILEGES ON nongtrai_test.* TO 'nongtrai'@'%';
CREATE DATABASE IF NOT EXISTS nongtrai_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON nongtrai_e2e.* TO 'nongtrai'@'%';
