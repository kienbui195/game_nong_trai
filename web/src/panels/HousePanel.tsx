import { SLEEP_MS_PER_POINT, STAMINA_MAX } from '@core';
import { Button } from '@/components/ui/button';
import { tokenUsername } from '@/lib/api';
import { useFarm } from '@/lib/farm';
import { useConfirm } from './Confirm';
import { fmtLeft } from '@/lib/time';
import { ActBtn, Note } from './ui';

export function HousePanel({ openJobs }: { openJobs: () => void }) {
  const { view, act, onLogout } = useFarm();
  const confirm = useConfirm();
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
        <Note>Thể lực không tự hồi. Ngủ trên giường để hồi dần (+1 mỗi {SLEEP_MS_PER_POINT / 1000} giây, đầy sau {fmtLeft(STAMINA_MAX * SLEEP_MS_PER_POINT)}).</Note>
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
      <Button
        variant="outline"
        className="h-11 w-full justify-start px-3 text-[15px]"
        data-testid="logout"
        onClick={async () => {
          const un = tokenUsername();
          const body = `${un ? `Tên đăng nhập của bạn: ${un}. ` : ''}Nông trại vẫn lưu trên server, đăng nhập lại là chơi tiếp.`;
          if (await confirm('Đăng xuất?', body, 'Đăng xuất')) onLogout();
        }}
      >
        🚪 Đăng xuất
      </Button>
    </div>
  );
}
