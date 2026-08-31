// 정규식 실행기 — 폭주하는 패턴에서 화면이 얼어붙지 않게 한다.
//
// **왜 이게 필요한가.** `(a+)+$` 같은 패턴을 조금 긴 문자열에 물리면 정규식 엔진이
// 지수적으로 되짚는다(치명적 백트래킹, ReDoS). 실측으로 **167초** 동안 탭이 멈췄다.
// 자바스크립트는 실행 중인 `exec()` 를 중단할 방법이 없다 — setTimeout 도, AbortController 도
// 소용없다. 그 코드가 스레드를 쥐고 있기 때문이다.
//
// 유일한 해결책은 **다른 스레드에서 돌리고 죽이는 것**이다. 워커는 terminate() 로 즉시 죽는다.
// 워커를 쓸 수 없는 환경(테스트·구형)에서는 그 자리에서 계산한다 — 그때는 멈출 수 있지만,
// 적어도 동작은 한다.

import { findMatches } from "./regexTester.js";

/** 이보다 오래 걸리면 폭주로 본다. 사람이 "느리네" 하고 넘길 수 있는 선. */
export const REGEX_TIMEOUT_MS = 1000;

const TIMEOUT_RESULT = {
  matches: [],
  truncated: false,
  timedOut: true,
  error: "이 패턴은 계산이 끝나지 않아 멈췄습니다. 되짚기가 폭주하는 형태일 수 있습니다(예: (a+)+).",
};

/** 기본 워커 만들기 — 브라우저에서만 된다 */
function defaultCreateWorker() {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../workers/regexWorker.js", import.meta.url), { type: "module" });
}

/**
 * 정규식 실행기를 만든다.
 *
 * @param {{createWorker?: (()=>Worker)|null, timeoutMs?: number}} [opts]
 *   createWorker 를 null 로 주면 워커 없이 그 자리에서 계산한다(테스트용).
 * @returns {{run: (pattern:string, flags:string, text:string)=>Promise<object>, dispose: ()=>void}}
 */
export function createRegexRunner(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? REGEX_TIMEOUT_MS;
  const makeWorker = opts.createWorker === undefined ? defaultCreateWorker : opts.createWorker;

  let worker = null;
  let seq = 0;
  let disposed = false;

  const killWorker = () => {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  };

  const run = (pattern, flags, text) => {
    if (disposed) return Promise.resolve({ ...TIMEOUT_RESULT, error: "실행기가 닫혔습니다." });

    // 앞의 요청은 버린다 — 타자를 칠 때마다 쌓이면 그것만으로 느려진다
    const id = ++seq;

    if (!makeWorker) {
      // 워커가 없으면 그 자리에서. 멈출 수는 없지만 동작은 한다.
      return Promise.resolve(findMatches(pattern, flags, text));
    }

    if (!worker) worker = makeWorker();
    if (!worker) return Promise.resolve(findMatches(pattern, flags, text));

    const mine = worker;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };

      const timer = setTimeout(() => {
        // 워커가 답이 없다 = 폭주 중이다. 죽이는 것 말고는 방법이 없다.
        killWorker();
        finish({ ...TIMEOUT_RESULT });
      }, timeoutMs);

      mine.onmessage = (e) => {
        if (id !== seq) { finish({ matches: [], superseded: true }); return; }
        finish(e.data);
      };
      mine.onerror = () => {
        killWorker();
        finish({ matches: [], truncated: false, error: "정규식을 계산하지 못했습니다." });
      };

      mine.postMessage({ pattern, flags, text });
    });
  };

  return {
    run,
    dispose() {
      disposed = true;
      killWorker();
    },
  };
}
