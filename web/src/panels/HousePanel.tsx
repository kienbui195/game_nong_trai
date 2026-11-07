import { SLEEP_MS_PER_POINT } from '@core';
import { useFarm } from '@/lib/farm';
import { fmtLeft } from '@/lib/time';
import { ActBtn, Note } from './ui';

export function HousePanel({ openJobs }: { openJobs: () => void }) {
  const { view, act } = useFarm();
  if (!view) return null;
  const full = view.stamina >= view.staminaMax;
  return (
    <div className="space-y-2">
      {view.sleeping ? (
        <Note tone="ok">
          💤 Đang ngủ · thể lực {view.stamina}/{view.staminaMax}
          {!full && ` · đầy sau ${fmtLeft((view.staminaMax - view.stamina) * SLEEP_MS_PER_POINT)}`}. Tắt app vẫn hồi.
        </Note>
      ) : (
        <Note>Thể lực không tự hồi. Ngủ trên giường để hồi dần (+1 mỗi 36 giây, đầy sau 60 phút).</Note>
      )}
      {view.sleeping ? (
        <ActBtn variant="default" onClick={() => act({ type: 'wake' })} testId="wake">
          ☀️ Dậy
        </ActBtn>
      ) : (
        <ActBtn variant="default" disabled={full} onClick={() => act({ type: 'sleep' })} testId="sleep">
          🛏️ Ngủ trên giường
        </ActBtn>
      )}
      <ActBtn onClick={openJobs} testId="open-computer">
        💻 Máy tính — việc làm thêm
      </ActBtn>
    </div>
  );
}
