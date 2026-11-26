// 로그인 상태.
//
// 세션 쿠키는 HttpOnly 라 **JS 가 읽을 수 없다.** 그래서 "로그인했나?"는 서버에 물어서 안다 —
// 자격(entitlement) API 가 200 이면 로그인, 401 이면 아니다. 그 응답(남은 명함 수)은 목록 화면도 쓰므로
// 한 번 물어 두고 같이 들고 있는다.
//
// 공개 명함(/c/:id)처럼 로그인이 상관없는 화면에선 묻지 않는다 — 받는 사람의 첫 화면을 늦출 이유가 없다.
// 그래서 확인은 필요한 화면이 요청할 때만(lazy) 한다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { setSessionExpiredHandler } from "../lib/http.js";
import { FullPageLoading, ErrorState } from "../components/States.jsx";

const AuthContext = createContext(null);

/** unknown(아직 안 물어봄) → checking → authed | guest | error */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState("unknown");
  const [entitlement, setEntitlement] = useState(null);
  const [error, setError] = useState(null);
  const inFlight = useRef(null);

  const check = useCallback(() => {
    // 여러 화면이 동시에 물어도 요청은 한 번만 보낸다.
    if (!inFlight.current) {
      setStatus("checking");
      inFlight.current = api
        .entitlement()
        .then((data) => {
          setEntitlement(data);
          setStatus("authed");
        })
        .catch((e) => {
          setEntitlement(null);
          if (e.status === 401) {
            setStatus("guest");
          } else {
            // 서버가 깨어나는 중 등 — 로그인 화면으로 튕기지 말고 다시 시도할 수 있게 한다.
            setError(e);
            setStatus("error");
          }
        })
        .finally(() => {
          inFlight.current = null;
        });
    }
    return inFlight.current;
  }, []);

  const markGuest = useCallback(() => {
    setEntitlement(null);
    setStatus("guest");
  }, []);

  /**
   * 로그인 상태는 그대로 두고 자격만 새로 받는다(예: 결제 화면에 들어올 때).
   *
   * ⚠️ 로그인된 화면 안에서는 {@link check} 대신 이걸 쓴다. check 는 상태를 "checking" 으로 바꾸는데,
   * 그러면 RequireAuth 가 로딩 화면을 그리느라 지금 화면을 언마운트하고 → 다시 마운트되며
   * 또 check 를 부르는 **무한 루프**가 된다.
   */
  const refreshEntitlement = useCallback(async () => {
    try {
      setEntitlement(await api.entitlement());
    } catch (e) {
      if (e.status === 401) markGuest();
      // 그 밖의 실패는 조용히 넘긴다 — 들고 있던 값으로 화면은 계속 보인다.
    }
  }, [markGuest]);

  // 쓰다가 세션이 완전히 끊기면(갱신까지 실패) 로그인 화면으로 보낸다.
  useEffect(() => {
    setSessionExpiredHandler(markGuest);
    return () => setSessionExpiredHandler(() => {});
  }, [markGuest]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // 서버 호출이 실패해도 화면은 로그아웃 상태로 둔다 — 남의 기기에서 "로그아웃 안 됨"이 더 위험하다.
      markGuest();
    }
  }, [markGuest]);

  const value = useMemo(
    () => ({ status, entitlement, error, check, refreshEntitlement, logout, markGuest, setEntitlement }),
    [status, entitlement, error, check, refreshEntitlement, logout, markGuest],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth 는 AuthProvider 안에서만 쓸 수 있다.");
  return value;
}

/** 로그인이 필요한 화면을 감싼다. 로그인 안 했으면 첫 화면(/)으로 보낸다. */
export function RequireAuth({ children }) {
  const { status, error, check } = useAuth();

  useEffect(() => {
    if (status === "unknown") check();
  }, [status, check]);

  if (status === "unknown" || status === "checking") return <FullPageLoading />;
  if (status === "guest") return <Navigate to="/" replace />;
  if (status === "error") return <ErrorState error={error} onRetry={check} fullPage />;
  return children;
}
