import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useFarm } from '@/lib/farm';

/** Nút việc: cao 44px, hiện thể lực / giá ở bên phải. */
export function ActBtn({ children, cost, onClick, disabled, variant = 'secondary', testId }: { children: ReactNode; cost?: string; onClick: () => void; disabled?: boolean; variant?: 'default' | 'secondary' | 'outline' | 'destructive'; testId?: string }) {
  const { locked } = useFarm();
  return (
    <Button data-testid={testId} variant={variant} className="h-11 w-full justify-between px-3 text-[15px]" disabled={disabled || locked} onClick={onClick}>
      <span className="truncate">{children}</span>
      {cost && <span className="ml-2 shrink-0 text-xs opacity-70">{cost}</span>}
    </Button>
  );
}

export function Meter({ label, value, max = 100, tone }: { label: string; value: number; max?: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? '[&>div]:bg-red-500' : tone === 'warn' ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-600';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.floor(value)}</span>
      </div>
      <Progress value={(value / max) * 100} className={`h-2 ${color}`} />
    </div>
  );
}

export const healthTone = (h: number) => (h < 30 ? 'bad' : h < 60 ? 'warn' : 'ok');

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' | 'bad' | 'ok' }) {
  const c = tone === 'bad' ? 'bg-red-50 text-red-800' : tone === 'warn' ? 'bg-amber-50 text-amber-900' : tone === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-muted text-muted-foreground';
  return <div className={`rounded-lg px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export const st = (n: number) => `${n} sức`;
export const xu = (n: number) => `${n.toLocaleString('vi-VN')} xu`;
