import 'reflect-metadata';
import { Body, Controller, Get, Headers, HttpException, Inject, Module, Post, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Pool } from 'mysql2/promise';
import { AdminApiController } from './admin';
import { AuthError, AuthService, type AuthUser } from './auth';
import { assertConfig, config } from './config';
import { POOL, makePool, migrate } from './db';
import { BadAction, FarmService } from './farm';
import { RateLimiter } from './rateLimit';

const authLimit = new RateLimiter(20, 60_000); // mỗi IP: đăng ký + đăng nhập mỗi phút
const actionLimit = new RateLimiter(240, 60_000); // mỗi người chơi: thao tác mỗi phút

const ipOf = (req: { headers: Record<string, string | string[] | undefined>; ip?: string }) =>
  String(req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();

const fail = (e: unknown): never => {
  if (e instanceof AuthError) throw new HttpException(e.message, e.status);
  throw e;
};

@Controller('api')
class AppController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(FarmService) private farms: FarmService,
    @Inject(POOL) private pool: Pool,
  ) {}

  private user(h?: string): AuthUser {
    const u = this.auth.verify(h?.replace(/^Bearer /, ''));
    if (!u) throw new HttpException('Cần đăng nhập.', 401);
    return u;
  }

  @Get('health')
  async health() {
    await this.pool.query('SELECT 1');
    return { status: 'ok' };
  }

  @Post('auth/register')
  async register(@Body() body: { displayName?: unknown; password?: unknown }, @Req() req: any) {
    if (!authLimit.take(ipOf(req))) throw new HttpException('Thử quá nhiều lần, đợi một chút nhé.', 429);
    try {
      return await this.auth.register(body?.displayName, body?.password);
    } catch (e) {
      return fail(e);
    }
  }

  @Post('auth/login')
  async login(@Body() body: { username?: unknown; password?: unknown }, @Req() req: any) {
    if (!authLimit.take(ipOf(req))) throw new HttpException('Thử quá nhiều lần, đợi một chút nhé.', 429);
    try {
      return await this.auth.login(body?.username, body?.password);
    } catch (e) {
      return fail(e);
    }
  }

  @Get('me')
  me(@Headers('authorization') h?: string) {
    return { user: this.user(h) };
  }

  @Get('farm')
  async farm(@Headers('authorization') h?: string) {
    const u = this.user(h);
    return { view: await this.farms.get(u.id), serverNow: Date.now() };
  }

  @Post('farm/actions')
  async action(@Headers('authorization') h: string | undefined, @Body() body: { id?: unknown; action?: unknown }) {
    const u = this.user(h);
    if (!actionLimit.take(String(u.id))) throw new HttpException('Thao tác nhanh quá, chậm lại một chút nhé.', 429);
    try {
      const out = await this.farms.act(u.id, body?.id, body?.action);
      if (!out.ok) {
        console.warn(`[action] user=${u.id} type=${String((body?.action as { type?: unknown })?.type)} code=${out.error?.code}`);
        throw new HttpException({ ...out, serverNow: Date.now() }, 409);
      }
      return { ...out, serverNow: Date.now() };
    } catch (e) {
      if (e instanceof BadAction) throw new HttpException(e.message, 400);
      throw e;
    }
  }
}

export async function createApp(opts: { pool?: Pool; migrate?: boolean; clock?: () => number } = {}) {
  assertConfig();
  const p = opts.pool ?? makePool();
  if (opts.migrate !== false) await migrate(p);

  @Module({
    controllers: [AppController, AdminApiController],
    providers: [
      { provide: POOL, useValue: p },
      { provide: AuthService, useValue: new AuthService(p) },
      { provide: FarmService, useValue: new FarmService(p, opts.clock) },
    ],
  })
  class AppModule {}

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors({ origin: (o: string | undefined, cb: (e: Error | null, ok: boolean) => void) => cb(null, !o || config.corsOrigins.includes(o)) });
  return { app, pool: p };
}

async function bootstrap() {
  const { app } = await createApp();
  await app.listen(config.port, config.host);
  console.log(`nongtrai-server listening on http://${config.host}:${config.port}`);
}

if (require.main === module) {
  bootstrap().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
