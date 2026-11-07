import { useState } from 'react';
import { toast } from 'sonner';
import { CROPS, SUPPLIES, itemEmoji, itemName, shopPrice } from '@core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFarm } from '@/lib/farm';
import { useConfirm } from './Confirm';
import { xu } from './ui';

const ARROW = { up: '▲', down: '▼', flat: '▬' } as const;
const ARROW_COLOR = { up: 'text-emerald-600', down: 'text-red-600', flat: 'text-muted-foreground' } as const;

export function MarketDialog({ open, tab, onOpenChange, onTab }: { open: boolean; tab: 'buy' | 'sell'; onOpenChange: (o: boolean) => void; onTab: (t: 'buy' | 'sell') => void }) {
  const { view } = useFarm();
  if (!view) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col">
        <DialogHeader>
          <DialogTitle>🏪 Chợ · {xu(view.coins)}</DialogTitle>
          <DialogDescription>Giá bán đổi mỗi 4 giờ. Bán nhiều một món thì giá món đó tụt, rồi hồi lại dần.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => onTab(v as 'buy' | 'sell')} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="sell" className="h-11" data-testid="tab-sell">
              Bán
            </TabsTrigger>
            <TabsTrigger value="buy" className="h-11" data-testid="tab-buy">
              Mua
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sell" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <SellList />
          </TabsContent>
          <TabsContent value="buy" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <BuyList />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SellList() {
  const { view, act, locked } = useFarm();
  const ask = useConfirm();
  if (!view) return null;
  const rows = view.market.flatMap((m) => {
    const s = view.inventory[m.itemId];
    if (!s) return [];
    return [
      ...(s.n > 0 ? [{ m, hq: false, have: s.n, price: m.price }] : []),
      ...(s.hq > 0 ? [{ m, hq: true, have: s.hq, price: m.hqPrice }] : []),
    ];
  });
  const sell = async (itemId: string, n: number, hq: boolean, expected: number) => {
    const err = await act({ type: 'sell', itemId, n, hq, expected }, { quiet: true, success: `Đã bán ${n} ${itemName(itemId).toLowerCase()}` });
    if (err?.code === 'price_changed') {
      const price = Number(err.data?.price);
      if (await ask('Giá vừa đổi', `Giá ${itemName(itemId).toLowerCase()} giờ là ${price} xu. Vẫn bán?`, 'Bán')) await act({ type: 'sell', itemId, n, hq, expected: price }, { success: 'Đã bán' });
    } else if (err && err.code !== 'net') toast.error(err.message);
  };
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">Kho chưa có gì để bán.</p>;
  return (
    <div className="space-y-2 py-2">
      {rows.map(({ m, hq, have, price }) => (
        <div key={m.itemId + hq} className="flex items-center gap-2 rounded-lg border px-2 py-2" data-testid={`sell-row-${m.itemId}${hq ? '-hq' : ''}`}>
          <span className="text-2xl">{itemEmoji(m.itemId)}</span>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium">
              {itemName(m.itemId)} {hq && <span className="text-amber-600">★ cao cấp</span>}
            </div>
            <div className="text-muted-foreground">
              có {have} · <span className={ARROW_COLOR[m.trend]}>{ARROW[m.trend]}</span> {price} xu/cái
            </div>
          </div>
          <Button size="sm" className="h-11 min-w-11" disabled={locked} onClick={() => sell(m.itemId, 1, hq, price)} data-testid="sell-1">
            Bán 1
          </Button>
          {have > 1 && (
            <Button size="sm" variant="secondary" className="h-11 min-w-11" disabled={locked} onClick={() => sell(m.itemId, have, hq, price)} data-testid="sell-all">
              Hết
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function BuyList() {
  const { view, act, locked } = useFarm();
  const [n, setN] = useState(1);
  if (!view) return null;
  const items = [...CROPS.filter((c) => c.season === view.season).map((c) => `seed:${c.id}`), ...Object.keys(SUPPLIES)];
  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center gap-2 text-sm">
        Số lượng:
        {[1, 5, 10].map((k) => (
          <Button key={k} size="sm" variant={n === k ? 'default' : 'outline'} className="h-11 w-12" onClick={() => setN(k)}>
            {k}
          </Button>
        ))}
      </div>
      {items.map((id) => {
        const price = shopPrice(id)!;
        return (
          <div key={id} className="flex items-center gap-2 rounded-lg border px-2 py-2" data-testid={`buy-row-${id}`}>
            <span className="text-2xl">{itemEmoji(id)}</span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">{itemName(id)}</div>
              <div className="text-muted-foreground">
                {price} xu · đang có {view.inventory[id]?.n ?? 0}
              </div>
            </div>
            <Button size="sm" className="h-11 min-w-11" disabled={locked || view.coins < price * n} onClick={() => act({ type: 'buy', itemId: id, n }, { success: `Đã mua ${n} ${itemName(id).toLowerCase()}` })} data-testid="buy">
              Mua {xu(price * n)}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
