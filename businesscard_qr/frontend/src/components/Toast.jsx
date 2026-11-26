// 짧은 알림(앱의 SnackBar). 디자인 킷에 토스트가 없어 .k-alert 를 띄워 쓴다.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

const DURATION_MS = 3200;

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, tone = "neutral") => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const toneClass = toast?.tone === "err" ? " k-alert--err" : toast?.tone === "ok" ? " k-alert--ok" : "";

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* aria-live — 화면이 바뀌지 않아도 스크린리더가 알림을 읽는다 */}
      <div className="bq-toast-layer" aria-live="polite" role="status">
        {toast && (
          <div key={toast.key} className={`k-alert bq-toast${toneClass}`}>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast 는 ToastProvider 안에서만 쓸 수 있다.");
  return show;
}
