const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 45230),
  host: process.env.HOST ?? '127.0.0.1',
  db: {
    // DATABASE_* là tên `vps db-create` ghi trên VPS; DB_* là cách viết khi chạy ở máy dev.
    host: process.env.DATABASE_HOST ?? process.env.DB_HOST ?? '127.0.0.1',
    port: num(process.env.DATABASE_PORT ?? process.env.DB_PORT, 3306),
    database: process.env.DATABASE_NAME ?? process.env.DB_NAME ?? 'nongtrai',
    user: process.env.DATABASE_USERNAME ?? process.env.DB_USER ?? 'nongtrai',
    password: process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? '',
  },
  /** token trang quản trị chung (admin.baodom.xyz) dùng gọi /admin-api; rỗng = /admin-api từ chối hết */
  adminApiToken: process.env.ADMIN_API_TOKEN ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtDays: num(process.env.JWT_DAYS, 30),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  version: process.env.APP_VERSION ?? '0.1.0',
  /** số lần đăng ký + đăng nhập mỗi phút mỗi IP */
  authPerMinute: num(process.env.AUTH_PER_MINUTE, 20),
};

export function assertConfig() {
  if (config.jwtSecret.length < 32) throw new Error('JWT_SECRET must be set (at least 32 characters).');
}
