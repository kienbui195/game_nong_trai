import { useState } from 'react';
import { ANIMALS, EXPANSION, FISH, HOUR, STAMINA_COST, feedFor, medFor } from '@core';
import { Button } from '@/components/ui/button';
import { useFarm } from '@/lib/farm';
import { fmtClock, pct } from '@/lib/time';
import { useConfirm } from './Confirm';
import { ActBtn, Meter, Note, healthTone, st, xu } from './ui';

export function EmptyBuildingPanel({ type }: { type: 'coop' | 'barn' | 'pond' }) {
  const { view, act } = useFarm();
  if (!view) return null;
  const cfg = EXPANSION.build[type];
  const price = view.expansion[type].price;
  return (
    <div className="space-y-2">
      <Note>
        Chỗ trống để xây {cfg.label.toLowerCase()} ({cfg.capacity} {type === 'pond' ? 'con cá' : 'chỗ'}).
      </Note>
      {price === null ? (
        <Note>Đã tối đa.</Note>
      ) : (
        <ActBtn variant="default" cost={xu(price)} onClick={() => act({ type: 'expand', what: type }, { success: `Đã xây ${cfg.label.toLowerCase()}!` })} testId={`build-${type}`}>
          🔨 Xây {cfg.label.toLowerCase()}
        </ActBtn>
      )}
    </div>
  );
}

export function BuildingPanel({ buildingId, openMarket }: { buildingId: number; openMarket: (tab: 'buy' | 'sell') => void }) {
  const { view, act } = useFarm();
  const ask = useConfirm();
  const [shop, setShop] = useState(false);
  if (!view) return null;
  const b = view.buildings.find((x) => x.id === buildingId);
  if (!b) return null;
  const cfg = EXPANSION.build[b.type];
  const upgrade = !b.upgraded && (
    <ActBtn variant="outline" cost={xu(cfg.upgradePrice)} onClick={() => act({ type: 'upgrade', buildingId }, { success: 'Đã nâng cấp!' })} testId="upgrade">
      ⬆️ Nâng thêm {cfg.upgradeAdd} chỗ
    </ActBtn>
  );

  if (b.type === 'pond') {
    const p = view.ponds.find((x) => x.buildingId === b.id)!;
    const feed = view.inventory['feed:fish']?.n ?? 0;
    return (
      <div className="space-y-3">
        <div className="font-semibold">
          Ao cá · {p.fish.length}/{b.capacity}
        </div>
        {p.fish.length > 0 && (
          <>
            <Meter label="Sức khoẻ ao" value={p.health} tone={healthTone(p.health)} />
            <Meter label="Tình cảm" value={p.affection} />
            {p.sick && <Note tone="bad">🤒 Cá đang ốm: không lớn. Cần thuốc cá.</Note>}
            {p.hungry ? <Note tone="warn">🍽️ Cá đang đói: dừng lớn.</Note> : p.fedUntil && <Note>No tới {fmtClock(p.fedUntil)}.</Note>}
          </>
        )}
        <div className="space-y-2">
          {p.fish.length > 0 && (
            <>
              <ActBtn cost={`🦐 ${feed} · ${st(STAMINA_COST.feedPond)}`} onClick={() => (feed ? act({ type: 'feedPond', buildingId }) : openMarket('buy'))} testId="feed-pond">
                {feed ? '🦐 Cho cả ao ăn' : '🦐 Hết thức ăn cá — tới cửa hàng'}
              </ActBtn>
              <ActBtn cost={p.talkToday ? 'hôm nay rồi' : st(STAMINA_COST.talkPond)} disabled={p.talkToday} onClick={() => act({ type: 'talkPond', buildingId })} testId="talk-pond">
                💬 Trò chuyện với ao
              </ActBtn>
              {p.sick && (
                <ActBtn cost={`🧫 ${view.inventory['med:fish']?.n ?? 0} · ${st(STAMINA_COST.medicatePond)}`} onClick={() => act({ type: 'medicatePond', buildingId })} testId="med-pond">
                  🧫 Cho thuốc cá
                </ActBtn>
              )}
            </>
          )}
        </div>
        <div className="space-y-1">
          {p.fish.map((f) => {
            const price = view.market.find((m) => m.itemId === `fish:${f.species}`)?.price ?? 0;
            return (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
                <span className="text-xl">{f.emoji}</span>
                <span className="flex-1 text-sm">
                  {f.name} · {f.mature ? 'đã lớn' : pct(f.progress)}
                </span>
                {f.mature && (
                  <Button size="sm" className="h-9" data-testid="sell-fish" onClick={() => act({ type: 'sellFish', buildingId, fishId: f.id, expected: price }, { success: 'Đã bán cá!' })}>
                    Bán ~{price}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {p.fish.length < b.capacity && (
          <>
            <ActBtn variant="default" onClick={() => setShop((s) => !s)} testId="buy-fish-toggle">
              🐟 Thả thêm cá giống
            </ActBtn>
            {shop &&
              FISH.map((f) => (
                <ActBtn key={f.id} cost={xu(f.price)} onClick={() => act({ type: 'buyFish', buildingId, species: f.id, n: 1 })} testId={`buy-fish-${f.id}`}>
                  {f.emoji} {f.name} · lớn sau {Math.round(f.matureMs / HOUR)} giờ
                </ActBtn>
              ))}
          </>
        )}
        {upgrade}
      </div>
    );
  }

  const list = view.animals.filter((a) => a.buildingId === b.id);
  const species = ANIMALS.filter((a) => a.building === b.type);
  const feedId = feedFor(species[0].id);
  const medId = medFor(species[0].id);
  return (
    <div className="space-y-3">
      <div className="font-semibold">
        {cfg.label} · {list.length}/{b.capacity}
      </div>
      {list.length === 0 && <Note>Chuồng trống. Mua con giống bên dưới.</Note>}
      {list.map((a) => (
        <div key={a.id} className="space-y-2 rounded-xl border p-3" data-testid="animal-card">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{a.emoji}</span>
            <div className="flex-1 text-sm">
              <div className="font-medium">
                {a.name} {a.mature ? '' : `(con, ${pct(a.progress)})`}
              </div>
              <div className="text-muted-foreground">
                {a.sick ? '🤒 Ốm' : a.hungry ? '🍽️ Đói' : a.fedUntil ? `No tới ${fmtClock(a.fedUntil)}` : ''}
                {a.mature && !a.product && !a.sick && !a.hungry ? ` · sản phẩm ${pct(a.progress)}` : ''}
              </div>
            </div>
          </div>
          <Meter label="Sức khoẻ" value={a.health} tone={healthTone(a.health)} />
          <Meter label="Tình cảm" value={a.affection} />
          <div className="grid grid-cols-2 gap-2">
            {a.product && (
              <ActBtn variant="default" cost={st(STAMINA_COST.collect)} onClick={() => act({ type: 'collect', animalId: a.id }, { success: 'Đã thu!' })} testId="collect">
                🥚 Thu
              </ActBtn>
            )}
            <ActBtn cost={st(STAMINA_COST.feed)} onClick={() => ((view.inventory[feedId]?.n ?? 0) > 0 ? act({ type: 'feed', animalId: a.id }) : openMarket('buy'))} testId="feed">
              🌾 Cho ăn
            </ActBtn>
            <ActBtn cost={a.petToday ? '✓' : st(STAMINA_COST.pet)} disabled={a.petToday} onClick={() => act({ type: 'pet', animalId: a.id })} testId="pet">
              🤲 Vuốt ve
            </ActBtn>
            <ActBtn cost={a.walkToday ? '✓' : st(STAMINA_COST.walk)} disabled={a.walkToday} onClick={() => act({ type: 'walk', animalId: a.id })} testId="walk">
              🚶 Đi dạo
            </ActBtn>
            {a.sick && (
              <ActBtn cost={`${view.inventory[medId]?.n ?? 0} · ${st(STAMINA_COST.medicate)}`} onClick={() => act({ type: 'medicate', animalId: a.id })} testId="medicate">
                💊 Cho thuốc
              </ActBtn>
            )}
            <ActBtn
              variant="outline"
              cost={xu(a.sellPrice)}
              testId="sell-animal"
              onClick={async () => {
                if (await ask(`Bán ${a.name.toLowerCase()}?`, `${a.mature ? 'Đã trưởng thành' : 'Chưa trưởng thành'}: bán được ${a.sellPrice} xu.`, 'Bán')) await act({ type: 'sellAnimal', animalId: a.id });
              }}
            >
              Bán
            </ActBtn>
          </div>
        </div>
      ))}
      {list.length < b.capacity &&
        species.map((s) => (
          <ActBtn key={s.id} variant="default" cost={xu(s.price)} onClick={() => act({ type: 'buyAnimal', species: s.id, buildingId }, { success: `Đã mua ${s.name.toLowerCase()}!` })} testId={`buy-${s.id}`}>
            {s.emoji} Mua {s.name.toLowerCase()} · {s.productName.toLowerCase()} mỗi {Math.round(s.cycleMs / HOUR)} giờ
          </ActBtn>
        ))}
      {upgrade}
    </div>
  );
}
