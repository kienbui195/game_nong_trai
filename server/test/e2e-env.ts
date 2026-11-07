// Nạp TRƯỚC mọi import khác của e2e-server: config.ts đọc process.env lúc được import.
process.env.JWT_SECRET ??= 'nongtrai-e2e-secret-nongtrai-e2e-secret!!';
process.env.ADMIN_API_TOKEN ??= 'admin-e2e-token-admin-e2e-token-admin-e2e-token';
process.env.CORS_ORIGINS ??= '';
process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '33073';
process.env.DB_NAME ??= 'nongtrai_e2e';
process.env.DB_USER ??= 'nongtrai';
process.env.DB_PASSWORD ??= 'dev';
process.env.AUTH_PER_MINUTE ??= '10000'; // cả bộ e2e đăng ký từ cùng 127.0.0.1
