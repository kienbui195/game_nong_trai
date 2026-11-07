import { useCallback, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { getToken, setToken } from '@/lib/api';
import { FarmProvider } from '@/lib/farm';
import { ConfirmProvider } from '@/panels/Confirm';
import { AuthScreen, GameScreen } from '@/screens';

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const logout = useCallback(() => {
    setToken(null);
    setAuthed(false);
  }, []);
  return (
    <ConfirmProvider>
      {authed ? (
        <FarmProvider onLogout={logout}>
          <GameScreen />
        </FarmProvider>
      ) : (
        <AuthScreen onDone={() => setAuthed(true)} />
      )}
      <Toaster position="top-center" richColors closeButton duration={2500} />
    </ConfirmProvider>
  );
}
