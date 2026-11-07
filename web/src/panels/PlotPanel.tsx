import { toast } from 'sonner';
import { CROPS, FERTILIZERS, STAMINA_COST, type FertilizerId } from '@core';
import { useFarm } from '@/lib/farm';
import { fmtClock, fmtLeft, pct, useNow } from '@/lib/time';
import { useConfirm } from './Confirm';
import { ActBtn, Meter, Note, healthTone, st } from './ui';

export function PlotPanel({ plotId, openMarket }: { plotId: number; openMarket: (tab: 'buy' | 'sell') => void }) {
  const { view, act } = useFarm();
  const ask = useConfirm();
  const now = useNow();
  if (!view) return null;
  const plot = view.plots[plotId];
  const c = plot?.crop;

  if (!c) {
    const seeds = CROPS.filter((x) => x.season === view.season && (view.inventory[`seed:${x.id}`]?.n ?? 0) > 0);
    const plant = async (cropId: string) => {
      const err = await act({ type: 'plant', plotId, cropId }, { quiet: true });
      if (err?.code === 'late') {
        if (await ask('Không kịp chín', err.message, 'Vẫn gieo')) await act({ type: 'plant', plotId, cropId, confirmLate: true });
      } else if (err && err.code !== 'net') toast.error(err.message);
    };
    return (
      <div className="space-y-2">
        <Note>Ô trống. Gieo hạt mùa {view.seasonLabel}.</Note>
        {seeds.length === 0 && (
          <ActBtn variant="default" onClick={() => openMarket('buy')} testId="go-buy-seeds">
            Chưa có hạt mùa này — tới cửa hàng
          </ActBtn>
        )}
        {seeds.map((s) => (
          <ActBtn key={s.id} cost={`${view.inventory[`seed:${s.id}`].n} · ${st(STAMINA_COST.plant)}`} onClick={() => plant(s.id)} testId={`plant-${s.id}`}>
            {s.emoji} {s.kind === 'tree' ? 'Trồng' : 'Gieo'} {s.name.toLowerCase()} · {s.kind === 'short' ? 'ngắn ngày' : s.kind === 'long' ? 'dài ngày' : 'cây ăn quả'}
          </ActBtn>
        ))}
      </div>
    );
  }

  const tree = c.kind === 'tree';
  const ferts = (Object.keys(FERTILIZERS) as FertilizerId[]).filter((k) => (view.inventory[`fert:${k}`]?.n ?? 0) > 0);
  const canFert = (!c.fertilizer || tree) && c.stage !== 'sleeping'; // cây ăn quả bón lại mỗi mùa (server kiểm)
  const stageText: Record<string, string> = {
    growing: 'Đang lớn',
    ripe: 'Đã chín — thu hoạch được',
    fruit: 'Có quả — thu được',
    mature: 'Cây đã lớn, đang chờ ra quả',
    withered: 'Cây đã héo (hết mùa)',
    sleeping: 'Ngoài mùa — cây đang ngủ',
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{c.stage === 'withered' ? '🥀' : c.emoji}</span>
        <div className="min-w-0">
          <div className="font-semibold">{c.name}</div>
          <div className="text-sm text-muted-foreground" data-testid="plot-stage">
            {stageText[c.stage]}
            {(c.stage === 'growing' || c.stage === 'mature') && ` · ${pct(c.progress)}`}
          </div>
        </div>
      </div>
      {c.stage !== 'withered' && <Meter label="Sức khoẻ" value={c.health} tone={healthTone(c.health)} />}
      {c.readyAt && <Note tone="ok">{tree && c.mature ? 'Ra quả' : 'Chín'} khoảng {fmtClock(c.readyAt)} (còn {fmtLeft(c.readyAt - now)}) nếu chăm đủ.</Note>}
      {c.dry && c.stage !== 'withered' && c.stage !== 'ripe' && <Note tone="warn">💧 Cây đang khô: dừng lớn, sức khoẻ giảm. Tưới ngay.</Note>}
      {!c.dry && c.waterUntil && c.stage !== 'ripe' && c.stage !== 'sleeping' && <Note>Đủ nước tới {fmtClock(c.waterUntil)}.</Note>}
      {c.pestSince !== null && <Note tone="bad">🐛 Có sâu từ {fmtClock(c.pestSince)}. Phun sớm (dưới 2 giờ) thì lớn tiếp ngay.</Note>}
      {c.recoverMs > 0 && <Note tone="warn">🩹 Đang hồi phục sau sâu: còn {fmtLeft(c.recoverMs)} không lớn.</Note>}
      {c.fertilizer && <Note>Đã bón {FERTILIZERS[c.fertilizer].name.toLowerCase()}. Tỷ lệ hàng cao cấp: {pct(c.qualityChance)}.</Note>}

      <div className="space-y-2">
        {(c.stage === 'ripe' || c.stage === 'fruit') && (
          <ActBtn variant="default" cost={st(STAMINA_COST.harvest)} onClick={() => act({ type: 'harvest', plotId }, { success: 'Đã thu hoạch!' })} testId="harvest">
            ✨ Thu hoạch
          </ActBtn>
        )}
        {c.stage !== 'withered' && c.stage !== 'ripe' && c.stage !== 'sleeping' && (
          <ActBtn cost={st(STAMINA_COST.water)} onClick={() => act({ type: 'water', plotId })} testId="water">
            💧 Tưới nước
          </ActBtn>
        )}
        {c.pestSince !== null && (
          <ActBtn cost={`🧴 ${view.inventory['med:pest']?.n ?? 0} · ${st(STAMINA_COST.spray)}`} onClick={() => act({ type: 'spray', plotId }, { success: 'Đã phun thuốc.' })} testId="spray">
            🧴 Phun thuốc trừ sâu
          </ActBtn>
        )}
        {canFert &&
          c.stage !== 'withered' &&
          c.stage !== 'ripe' &&
          ferts.map((k) => (
            <ActBtn key={k} cost={`${view.inventory[`fert:${k}`].n} · ${st(STAMINA_COST.fertilize)}`} onClick={() => act({ type: 'fertilize', plotId, fertilizer: k })} testId={`fert-${k}`}>
              Bón {FERTILIZERS[k].name.toLowerCase()} (+{Math.round(FERTILIZERS[k].speed * 100)}% lớn)
            </ActBtn>
          ))}
        {(c.stage === 'withered' || tree) && (
          <ActBtn
            variant={tree ? 'outline' : 'secondary'}
            cost={st(STAMINA_COST.clear)}
            testId="clear"
            onClick={async () => {
              if (tree && !(await ask('Chặt cây?', `Chặt cây ${c.name.toLowerCase()} thì mất cây, ô trống lại.`, 'Chặt'))) return;
              await act({ type: 'clear', plotId });
            }}
          >
            {tree ? '🪓 Chặt cây' : '🧹 Dọn cây héo'}
          </ActBtn>
        )}
        {(c.pestSince !== null && !(view.inventory['med:pest']?.n)) || (canFert && ferts.length === 0 && c.stage === 'growing') ? (
          <ActBtn variant="outline" onClick={() => openMarket('buy')}>
            🛒 Mua phân, thuốc ở cửa hàng
          </ActBtn>
        ) : null}
      </div>
    </div>
  );
}
