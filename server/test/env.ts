// Nạp đầu tiên: config.ts đọc process.env lúc được import.
process.env.JWT_SECRET = 'nongtrai-test-secret-nongtrai-test-secret!';
process.env.ADMIN_API_TOKEN = 'admin-test-token-admin-test-token-admin-test-token';
process.env.CORS_ORIGINS = 'http://localhost';
process.env.DB_HOST = process.env.TEST_DB_HOST ?? '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT ?? '33073';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'nongtrai_test';
process.env.DB_USER = process.env.TEST_DB_USER ?? 'nongtrai';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? 'dev';
