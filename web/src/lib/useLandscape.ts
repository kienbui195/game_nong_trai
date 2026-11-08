import { useEffect, useState } from 'react';

// Màn ngang (desktop, điện thoại xoay ngang): bản đồ vẽ 22×12, bảng thao tác mở từ bên phải.
// Cùng điều kiện với FarmScene (rộng > cao) để bản đồ và bảng luôn khớp nhau.
const Q = '(orientation: landscape)';

export function useLandscape() {
  const [on, setOn] = useState(() => window.matchMedia(Q).matches);
  useEffect(() => {
    const m = window.matchMedia(Q);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return on;
}
