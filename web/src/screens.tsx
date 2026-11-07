import { useCallback, useEffect, useState } from 'react';
import { SEASON_DAYS, STAMINA_MAX } from '@core';
import { toast } from 'sonner';
import { Maximize, Package, Hammer, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhaserMap } from '@/game/PhaserMap';
import type { Target } from '@/game/layout';
import { ApiError, NetError, login, register, setToken } from '@/lib/api';
import { useFarm } from '@/lib/farm';
import { BuildingPanel, EmptyBuildingPanel } from '@/panels/BuildingPanel';
import { HousePanel } from '@/panels/HousePanel';
import { JobDialog } from '@/panels/JobDialog';
import { MarketDialog } from '@/panels/MarketDialog';
import { ExpandDialog, InventoryDialog } from '@/panels/MiscDialogs';
import { PlotPanel } from '@/panels/PlotPanel';
import { Note } from '@/panels/ui';
import { InstallHint, useWakeLock } from '@/pwa';

// ---------------------------------------------------------------- đăng nhập / đăng ký

export function AuthScreen({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ token: string; user: { username: string } }>, showName: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fn();
      setToken(r.token);
      if (showName) setNewName(r.user.username);
      else onDone();
    } catch (e) {
      setErr(e instanceof NetError ? 'Không kết nối được server. Thử lại nhé.' : e instanceof ApiError ? e.message : 'Có lỗi.');
    } finally {
      setBusy(false);
    }
  };

  if (newName)
    return (
      <div className="scroll-area flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>🎉 Tạo nông trại xong!</CardTitle>
            <CardDescription>Ghi nhớ tên đăng nhập để vào lại trên máy khác:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-3 text-center font-mono text-xl font-bold" data-testid="new-username">
              {newName}
            </div>
            <Button className="h-11 w-full" onClick={onDone} data-testid="enter-farm">
              Vào nông trại
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="scroll-area flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">🌾 Nông Trại Xu</CardTitle>
          <CardDescription>Trồng cây, nuôi con, bán ở chợ, làm thêm bằng trả lời câu hỏi.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="register">
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="register">Chơi mới</TabsTrigger>
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
            </TabsList>
            <TabsContent value="register" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label htmlFor="dn">Tên hiển thị</Label>
                <Input id="dn" className="h-11 text-base" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" enterKeyHint="next" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pw1">Mật khẩu (ít nhất 6 ký tự)</Label>
                <Input id="pw1" type="password" className="h-11 text-base" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" enterKeyHint="go" />
              </div>
              {err && <Note tone="bad">{err}</Note>}
              <Button className="h-11 w-full" disabled={busy} onClick={() => run(() => register(name, password), true)} data-testid="register">
                Tạo nông trại
              </Button>
            </TabsContent>
            <TabsContent value="login" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label htmlFor="un">Tên đăng nhập</Label>
                <Input id="un" className="h-11 text-base" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" enterKeyHint="next" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pw2">Mật khẩu</Label>
                <Input id="pw2" type="password" className="h-11 text-base" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" enterKeyHint="go" />
              </div>
              {err && <Note tone="bad">{err}</Note>}
              <Button className="h-11 w-full" disabled={busy} onClick={() => run(() => login(username, password), false)} data-testid="login">
                Vào nông trại
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- màn chơi

const TITLE: Record<Target['kind'], string> = { plot: 'Ô đất', lockedPlot: 'Đất chưa mua', house: 'Nhà', market: 'Chợ', building: 'Chuồng / ao', emptyBuilding: 'Chỗ trống' };

export function GameScreen() {
  const { view, online, refresh, onLogout } = useFarm();
  const [target, setTarget] = useState<Target | null>(null);
  const [market, setMarket] = useState<{ open: boolean; tab: 'buy' | 'sell' }>({ open: false, tab: 'sell' });
  const [jobs, setJobs] = useState(false);
  const [expand, setExpand] = useState(false);
  const [inv, setInv] = useState(false);
  useWakeLock();

  const openMarket = useCallback((tab: 'buy' | 'sell') => {
    setTarget(null);
    setMarket({ open: true, tab });
  }, []);
  const onArrive = useCallback(
    (t: Target) => {
      if (t.kind === 'market') return openMarket('sell');
      if (t.kind === 'lockedPlot') return setExpand(true);
      setTarget(t);
    },
    [openMarket],
  );
  const hooks = { onArrive, onNoPath: () => toast('Không tới được chỗ đó.') };

  useEffect(() => {
    if (view?.job.active) setJobs(true); // đang làm dở việc thì mở lại máy tính
  }, [view?.job.active?.id]);

  return (
    <>
      <header className="z-10 flex shrink-0 items-center gap-2 bg-emerald-900 px-3 py-2 text-white">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span data-testid="hud-coins">🪙 {view?.coins.toLocaleString('vi-VN') ?? '—'}</span>
            <span className="opacity-80" data-testid="hud-season">
              {view ? `${view.seasonLabel} · ngày ${view.dayInSeason}/${SEASON_DAYS} · năm ${view.year}` : ''}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span>⚡</span>
            <Progress value={view ? (view.stamina / view.staminaMax) * 100 : 0} className="h-2 flex-1 bg-emerald-950 [&>div]:bg-yellow-400" />
            <span data-testid="hud-stamina">
              {view?.stamina ?? 0}/{view?.staminaMax ?? STAMINA_MAX}
              {view?.sleeping && ' 💤'}
            </span>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="size-11 text-white" aria-label="Kho" onClick={() => setInv(true)} data-testid="open-inventory">
          <Package />
        </Button>
        <Button size="icon" variant="ghost" className="size-11 text-white" aria-label="Mở rộng" onClick={() => setExpand(true)} data-testid="open-expand">
          <Hammer />
        </Button>
        <Button size="icon" variant="ghost" className="size-11 text-white" aria-label="Toàn màn hình" onClick={() => document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined)}>
          <Maximize />
        </Button>
      </header>
      {online === 'offline' && (
        <div className="z-10 flex shrink-0 items-center gap-2 bg-red-600 px-3 py-2 text-sm text-white" data-testid="offline-banner">
          <span className="flex-1">⚠️ Mất kết nối — tạm khoá mọi việc.</span>
          <Button size="sm" variant="secondary" className="h-9" onClick={() => void refresh()}>
            Thử lại
          </Button>
        </div>
      )}
      <InstallHint />
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <PhaserMap view={view} hooks={hooks} />
        {!view && online === 'ok' && <div className="absolute inset-0 flex items-center justify-center text-white">Đang tải nông trại…</div>}
      </main>

      <Drawer open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DrawerContent data-testid="sheet">
          <DrawerHeader className="pb-1">
            <DrawerTitle>{target ? TITLE[target.kind] : ''}</DrawerTitle>
            <DrawerDescription className="sr-only">Việc làm được ở đây</DrawerDescription>
          </DrawerHeader>
          <div className="scroll-area max-h-[65dvh] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            {target?.kind === 'plot' && <PlotPanel plotId={target.plotId} openMarket={openMarket} />}
            {target?.kind === 'house' && (
              <HousePanel
                openJobs={() => {
                  setTarget(null);
                  setJobs(true);
                }}
              />
            )}
            {target?.kind === 'building' && <BuildingPanel buildingId={target.buildingId} openMarket={openMarket} />}
            {target?.kind === 'emptyBuilding' && <EmptyBuildingPanel type={target.type} />}
          </div>
        </DrawerContent>
      </Drawer>
      <MarketDialog open={market.open} tab={market.tab} onTab={(tab) => setMarket({ open: true, tab })} onOpenChange={(o) => setMarket((m) => ({ ...m, open: o }))} />
      <JobDialog open={jobs} onOpenChange={setJobs} />
      <ExpandDialog open={expand} onOpenChange={setExpand} />
      <InventoryDialog open={inv} onOpenChange={setInv} />
      <button className="sr-only" onClick={onLogout} aria-label="Đăng xuất">
        <LogOut />
      </button>
    </>
  );
}
