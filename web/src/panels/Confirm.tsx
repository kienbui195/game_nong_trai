import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Ask = (title: string, body: string, yes?: string) => Promise<boolean>;
const Ctx = createContext<Ask>(async () => false);
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [q, setQ] = useState<{ title: string; body: string; yes: string; done: (v: boolean) => void } | null>(null);
  const ask = useCallback<Ask>((title, body, yes = 'Đồng ý') => new Promise((done) => setQ({ title, body, yes, done })), []);
  const close = (v: boolean) => {
    q?.done(v);
    setQ(null);
  };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <Dialog open={!!q} onOpenChange={(o) => !o && close(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{q?.title}</DialogTitle>
            <DialogDescription>{q?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => close(false)}>
              Thôi
            </Button>
            <Button className="h-11" data-testid="confirm-yes" onClick={() => close(true)}>
              {q?.yes}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
