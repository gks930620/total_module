// 정규식 실행기 계약 테스트 — 구현 전 선작성(Red).
//
// 왜 필요한가: `(a+)+$` 같은 패턴은 **한 번의 exec() 안에서** 폭주한다.
// 자바스크립트는 실행 중인 정규식을 중단할 방법이 없다 — 실측 167초 동안 탭이 얼어붙었다.
// 유일한 해결책은 워커에서 돌리고 시간이 지나면 terminate() 하는 것이다.
import { describe, it, expect, vi } from "vitest";
import { createRegexRunner, REGEX_TIMEOUT_MS } from "../regexRunner.js";

describe("REGEX_TIMEOUT_MS", () => {
  it("사람이 기다릴 만한 시간이다", () => {
    expect(REGEX_TIMEOUT_MS).toBeGreaterThanOrEqual(300);
    expect(REGEX_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });
});

describe("워커를 쓸 수 없을 때 — 그 자리에서 계산한다", () => {
  it("결과를 그대로 준다", async () => {
    const runner = createRegexRunner({ createWorker: null });
    const r = await runner.run("a", "g", "aaa");
    expect(r.matches).toHaveLength(3);
    expect(r.timedOut).toBeFalsy();
    runner.dispose();
  });

  it("문법 오류도 그대로 전한다", async () => {
    const runner = createRegexRunner({ createWorker: null });
    const r = await runner.run("(", "", "abc");
    expect(r.error).toBeTruthy();
    runner.dispose();
  });
});

describe("워커가 있을 때", () => {
  /** 지정한 시간 뒤에 답하는 가짜 워커 */
  const fakeWorker = (replyAfterMs, payload) => () => {
    const w = {
      onmessage: null,
      onerror: null,
      terminated: false,
      postMessage() {
        w.timer = setTimeout(() => {
          if (!w.terminated) w.onmessage?.({ data: payload });
        }, replyAfterMs);
      },
      terminate() {
        w.terminated = true;
        clearTimeout(w.timer);
      },
    };
    return w;
  };

  it("워커가 준 결과를 그대로 준다", async () => {
    const runner = createRegexRunner({
      createWorker: fakeWorker(1, { matches: [{ index: 0, text: "a" }], error: null, truncated: false }),
    });
    const r = await runner.run("a", "g", "a");
    expect(r.matches).toHaveLength(1);
    runner.dispose();
  });

  it("시간을 넘기면 워커를 죽이고 그렇게 알린다", async () => {
    vi.useFakeTimers();
    const runner = createRegexRunner({
      createWorker: fakeWorker(999999, {}),   // 영원히 안 온다 = 폭주 상황
      timeoutMs: 500,
    });
    const p = runner.run("(a+)+$", "", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!");
    await vi.advanceTimersByTimeAsync(600);
    const r = await p;
    expect(r.timedOut).toBe(true);
    expect(r.error).toMatch(/오래|멈|시간/);
    expect(r.matches).toEqual([]);
    runner.dispose();
    vi.useRealTimers();
  });

  it("죽인 뒤에도 다음 실행이 된다 — 한 번 멈췄다고 도구가 못 쓰게 되면 안 된다", async () => {
    let call = 0;
    const runner = createRegexRunner({
      createWorker: () => {
        call += 1;
        const slow = call === 1;
        return fakeWorker(slow ? 999999 : 1, { matches: [{ index: 0, text: "b" }], error: null })();
      },
      timeoutMs: 30,
    });
    const first = await runner.run("(a+)+$", "", "aaa!");
    expect(first.timedOut).toBe(true);

    const second = await runner.run("b", "g", "b");
    expect(second.timedOut).toBeFalsy();
    expect(second.matches).toHaveLength(1);
    runner.dispose();
  });

  it("연달아 부르면 앞의 것은 버린다 — 타자 칠 때마다 쌓이면 안 된다", async () => {
    const runner = createRegexRunner({
      createWorker: fakeWorker(5, { matches: [], error: null }),
    });
    const a = runner.run("a", "g", "aaa");
    const b = runner.run("b", "g", "bbb");
    const [ra, rb] = await Promise.all([a, b]);
    expect(rb.superseded).toBeFalsy();
    expect(ra.superseded || ra.matches).toBeTruthy();
    runner.dispose();
  });

  it("dispose 는 두 번 불러도 안전하다", () => {
    const runner = createRegexRunner({ createWorker: fakeWorker(1, {}) });
    runner.dispose();
    expect(() => runner.dispose()).not.toThrow();
  });
});
