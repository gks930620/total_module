// 내 명함 목록 캐시 — 앱의 전략을 그대로 옮겼다(기억할거/businesscard_qr 기억할 내용.md §1).
//
//  - 목록에 처음 들어올 때 1페이지만 받고, 스크롤이 바닥에 닿으면 다음 페이지를 이어 붙인다.
//  - 상세·수정으로 갔다 와도 **다시 받지 않는다**(메모리에 들고 있다).
//  - 등록·수정·삭제는 API 성공 후 캐시만 고친다(목록 재조회 없음).
//
// 이유: 첫 화면의 진짜 병목은 목록 API 가 아니라 Railway App Sleeping 콜드스타트(10~30초)다.
// 화면을 오갈 때마다 다시 받으면 그 기다림을 매번 겪는다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const PAGE_SIZE = 20;
const EMPTY = { cards: [], nextPage: 0, hasMore: true, loaded: false };

const CardsContext = createContext(null);

export function CardsProvider({ children }) {
  const { status, entitlement, setEntitlement } = useAuth();
  const [state, setState] = useState(EMPTY);
  const loading = useRef(false);

  // 로그아웃·탈퇴·세션 만료 — 다음 사람이 앞사람 명함을 보지 않도록 즉시 비운다.
  useEffect(() => {
    if (status === "guest") setState(EMPTY);
  }, [status]);

  /** 다음 페이지를 붙인다. 이미 받는 중이면 겹쳐 부르지 않는다(스크롤 이벤트가 연달아 와도). */
  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const pageNo = state.loaded ? state.nextPage : 0;
      const page = await api.listCards(pageNo, PAGE_SIZE);
      setState((previous) => ({
        cards: pageNo === 0 ? page.content : [...previous.cards, ...page.content],
        nextPage: pageNo + 1,
        hasMore: !page.last,
        loaded: true,
      }));
    } finally {
      loading.current = false;
    }
  }, [state.loaded, state.nextPage]);

  /** 당겨서 새로고침 — 캐시를 버리고 1페이지부터. */
  const reload = useCallback(async () => {
    loading.current = false;
    const page = await api.listCards(0, PAGE_SIZE);
    setState({ cards: page.content, nextPage: 1, hasMore: !page.last, loaded: true });
  }, []);

  const adjustCount = useCallback(
    (delta) => {
      if (!entitlement) return;
      // 자격(pro·만료)은 서버만 정한다. 화면에서 바꾸는 건 "몇 장 썼나" 하나뿐이다.
      setEntitlement({ ...entitlement, card_count: Math.max(0, (entitlement.card_count ?? 0) + delta) });
    },
    [entitlement, setEntitlement],
  );

  const added = useCallback(
    (card) => {
      // 새 명함은 맨 위 — 서버도 최신 등록순으로 준다.
      setState((previous) => ({ ...previous, cards: [card, ...previous.cards.filter((c) => c.id !== card.id)] }));
      adjustCount(+1);
    },
    [adjustCount],
  );

  const updated = useCallback((card) => {
    setState((previous) => ({ ...previous, cards: previous.cards.map((c) => (c.id === card.id ? card : c)) }));
  }, []);

  const removed = useCallback(
    (cardId) => {
      setState((previous) => ({ ...previous, cards: previous.cards.filter((c) => c.id !== cardId) }));
      adjustCount(-1);
    },
    [adjustCount],
  );

  /** 캐시에 있으면 그걸 주고, 없으면(링크로 바로 들어온 경우) null. */
  const find = useCallback((cardId) => state.cards.find((c) => c.id === cardId) ?? null, [state.cards]);

  const value = useMemo(
    () => ({ ...state, loadMore, reload, added, updated, removed, find }),
    [state, loadMore, reload, added, updated, removed, find],
  );
  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards() {
  const value = useContext(CardsContext);
  if (!value) throw new Error("useCards 는 CardsProvider 안에서만 쓸 수 있다.");
  return value;
}
