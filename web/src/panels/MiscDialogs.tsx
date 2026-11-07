import { EXPANSION, itemEmoji, itemName } from '@core';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFarm } from '@/lib/farm';
import { ActBtn, Note, xu } from './ui';

export function ExpandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { view, act } = useFarm();
  if (!view) return null;
  const e = view.expansion;
  const builds = (['coop', 'barn', 'pond'] as const).map((t) => ({ t, ...EXPANSION.build[t], price: e[t].price, have: view.buildings.filter((b) => b.type === t).length }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col">
        <DialogHeader>
          <DialogTitle>🏗️ Mở rộng · {xu(view.coins)}</DialogTitle>
          <DialogDescription>Mua thêm đất, chuồng, ao. Nâng sức chứa ở từng chuồng/ao.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
          <Note>
            Đất: {e.plots.count}/{e.plots.max} ô
          </Note>
          {e.plots.price === null ? (
            <ActBtn disabled onClick={() => undefined}>
              Đất đã tối đa
            </ActBtn>
          ) : (
            <ActBtn variant="default" cost={xu(e.plots.price)} onClick={() => act({ type: 'expand', what: 'plots' }, { success: `Có thêm ${EXPANSION.plotsPerBuy} ô đất!` })} testId="expand-plots">
              🟫 Thêm {EXPANSION.plotsPerBuy} ô đất
            </ActBtn>
          )}
          {builds.map((b) =>
            b.price === null ? (
              <ActBtn key={b.t} disabled onClick={() => undefined}>
                {b.label}: đã tối đa ({b.have}/{b.prices.length})
              </ActBtn>
            ) : (
              <ActBtn key={b.t} variant="secondary" cost={xu(b.price)} onClick={() => act({ type: 'expand', what: b.t }, { success: `Đã xây ${b.label.toLowerCase()}!` })} testId={`expand-${b.t}`}>
                🔨 Xây {b.label.toLowerCase()} ({b.have}/{b.prices.length})
              </ActBtn>
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { view } = useFarm();
  if (!view) return null;
  const rows = Object.entries(view.inventory).filter(([, s]) => s.n + s.hq > 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col">
        <DialogHeader>
          <DialogTitle>🎒 Kho</DialogTitle>
          <DialogDescription>Hàng trong kho không hỏng. Mang ra chợ để bán.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Kho trống.</p>}
          <div className="grid grid-cols-2 gap-2">
            {rows.map(([id, s]) => (
              <div key={id} className="flex items-center gap-2 rounded-lg border px-2 py-2 text-sm">
                <span className="text-2xl">{itemEmoji(id)}</span>
                <div>
                  <div className="font-medium">{itemName(id)}</div>
                  <div className="text-muted-foreground">
                    {s.n}
                    {s.hq > 0 && <span className="text-amber-600"> + {s.hq}★</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
