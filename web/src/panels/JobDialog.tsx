import { JOBS, type JobLevel } from '@core';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useFarm } from '@/lib/farm';
import { fmtClock, fmtLeft, useNow } from '@/lib/time';
import { Note, xu } from './ui';

const LETTERS = ['A', 'B', 'C', 'D'];
const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function JobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { view, act, locked } = useFarm();
  const now = useNow(open ? 250 : 60_000); // chỉ chạy nhanh khi đang mở
  if (!view) return null;
  const j = view.job;
  const a = j.active;
  const left = a ? Math.max(0, a.deadline - now) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (a && !o ? undefined : onOpenChange(o))}>
      <DialogContent className="flex max-h-[90dvh] flex-col">
        <DialogHeader>
          <DialogTitle>💻 Việc làm thêm · {xu(view.coins)}</DialogTitle>
          <DialogDescription>
            Trả phí để nhận việc. Đúng đủ 10/10 câu trong thời gian của đề mới được thưởng; sai một câu hoặc hết giờ là mất phí. Không tốn và không hồi thể lực.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
          {a ? (
            <div className="space-y-3" data-testid="job-active">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Câu {a.idx + 1}/{a.total} · {JOBS.levels[a.level as JobLevel].label}
                </span>
                <span className={`font-bold tabular-nums ${left < 30_000 ? 'text-red-600' : 'text-amber-600'}`} data-testid="job-timer" title="Thời gian còn lại cho cả đề">
                  ⏱ {mmss(left)}
                </span>
              </div>
              <Progress value={(left / JOBS.levels[a.level as JobLevel].totalMs) * 100} className="h-2" />
              <h3 className="text-lg font-semibold leading-snug" data-testid="job-question">
                {a.question.text}
              </h3>
              <div className="grid gap-2">
                {a.question.options.map((o, i) => (
                  <Button key={i} variant="outline" className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left text-[15px]" disabled={locked} data-testid={`job-option-${i}`} onClick={() => act({ type: 'answer', idx: a.idx, choice: i })}>
                    <span className="mr-2 font-bold text-amber-600">{LETTERS[i]}</span>
                    {o}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {j.last && (
                <Note tone={j.last.ok ? 'ok' : 'bad'}>
                  {j.last.ok ? (
                    <>🎉 Xong việc! +{j.last.reward} xu.</>
                  ) : (
                    <span data-testid="job-failed">
                      ✘ {j.last.reason === 'timeout' ? 'Hết giờ' : 'Sai'} ở câu {j.last.answered + 1}. Mất {j.last.fee} xu phí.
                      {j.last.missed && (
                        <>
                          <br />
                          Câu: {j.last.missed.text}
                          <br />
                          Đáp án đúng: <b>{j.last.missed.answer}</b>
                        </>
                      )}
                    </span>
                  )}
                </Note>
              )}
              <div className="text-sm text-muted-foreground">
                Hôm nay đã nhận {j.taken}/{j.perDay} việc · làm mới miễn phí lúc {fmtClock(j.nextFreeAt)} (còn {fmtLeft(j.nextFreeAt - now)})
              </div>
              {j.offers.length === 0 && <Note>Chưa có việc. Chờ làm mới, hoặc đổi danh sách.</Note>}
              {j.offers.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-xl border p-3" data-testid="job-offer">
                  <div className="flex-1 text-sm">
                    <div className="font-semibold">
                      Việc {JOBS.levels[o.level as JobLevel].label.toLowerCase()} · {JOBS.questionsPerJob} câu · ⏱ {mmss(JOBS.levels[o.level as JobLevel].totalMs)}
                    </div>
                    <div className="text-muted-foreground">
                      Phí {o.fee} xu → thưởng <b className="text-emerald-700">{o.reward} xu</b>
                    </div>
                  </div>
                  <Button className="h-11" disabled={locked || view.coins < o.fee || j.taken >= j.perDay} onClick={() => act({ type: 'acceptJob', offerId: o.id })} data-testid="job-accept">
                    Nhận
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="h-11 w-full" disabled={locked || view.coins < j.rerollCost} onClick={() => act({ type: 'rerollJobs' })} data-testid="job-reroll">
                🔄 Đổi danh sách ngay · {xu(j.rerollCost)}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
