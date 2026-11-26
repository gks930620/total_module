// 무료 한도 판정 — 등록 화면 진입 가드와 프로 화면 경고가 같은 규칙을 쓴다.
// 화면은 안내만 한다. 최종 판정은 서버다(넘치면 CARD_LIMIT_EXCEEDED).

/** 자격(entitlement)으로 본 "더 만들 수 없음". card_limit 이 null·없음이면 무제한(프로)이다. */
export function isAtCardLimit(entitlement) {
  const limit = entitlement?.card_limit;
  return typeof limit === "number" && (entitlement.card_count ?? 0) >= limit;
}
