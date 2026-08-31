// 정규식 매칭 워커 — 폭주해도 메인 스레드가 살아 있게 한다.
//
// 여기서 도는 코드는 얼마든지 멈춰도 된다. 부모가 terminate() 로 죽이면 그만이다.
// 메인 스레드에서 돌리면 그럴 수 없어 탭 전체가 얼어붙는다(실측 167초).
//
// 메시지 IN : { pattern, flags, text }
// 메시지 OUT: findMatches 의 결과 그대로 — { matches, error, truncated }

import { findMatches } from "../lib/regexTester.js";

self.onmessage = (e) => {
  const { pattern, flags, text } = e.data || {};
  try {
    self.postMessage(findMatches(pattern, flags, text));
  } catch (err) {
    self.postMessage({ matches: [], truncated: false, error: err?.message || "정규식 계산에 실패했습니다." });
  }
};
