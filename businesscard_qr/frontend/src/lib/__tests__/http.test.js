// 공통 HTTP 계약 — 모든 API 호출은 이 모듈 하나만 거친다(코드컨벤션 §7).
// 세션은 HttpOnly 쿠키라 JS 가 토큰을 만질 일이 없다. 여기서 하는 일은
// ① 응답 해석 ② 401 이면 한 번만 갱신하고 재시도 ③ 오류를 errorCode 중심으로 통일.
import { describe, it, expect, vi } from "vitest";
import { createHttp, ApiError } from "../http.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const ok = (data) => json(200, { success: true, message: "ok", data });

describe("http", () => {
  it("성공하면 data 만 돌려준다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ id: "1" }));
    const http = createHttp({ fetchImpl });
    await expect(http.request("/api/x")).resolves.toEqual({ id: "1" });
  });

  it("쿠키가 실리도록 same-origin 자격증명으로 보낸다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(null));
    await createHttp({ fetchImpl }).request("/api/x");
    expect(fetchImpl.mock.calls[0][1].credentials).toBe("same-origin");
  });

  it("객체 본문은 JSON 으로 보낸다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(null));
    await createHttp({ fetchImpl }).request("/api/x", { method: "POST", body: { a: 1 } });
    const init = fetchImpl.mock.calls[0][1];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("FormData 는 Content-Type 을 직접 넣지 않는다 — 브라우저가 boundary 를 붙여야 한다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(null));
    const form = new FormData();
    form.append("payload", "{}");
    await createHttp({ fetchImpl }).request("/api/x", { method: "POST", body: form });
    const init = fetchImpl.mock.calls[0][1];
    expect(init.body).toBe(form);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("실패 응답은 서버의 errorCode 를 그대로 담아 던진다 — 화면은 코드로 분기한다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json(400, { success: false, message: "한도 초과", errorCode: "CARD_LIMIT_EXCEEDED" }),
    );
    const error = await createHttp({ fetchImpl }).request("/api/x").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.errorCode).toBe("CARD_LIMIT_EXCEEDED");
  });

  it("success:false 는 200 이어도 실패다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { success: false, message: "no" }));
    await expect(createHttp({ fetchImpl }).request("/api/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("401 이면 세션을 한 번 갱신하고 원래 요청을 다시 보낸다", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(401, { success: false }))
      .mockResolvedValueOnce(ok(null)) // /api/auth/refresh
      .mockResolvedValueOnce(ok({ again: true }));
    const result = await createHttp({ fetchImpl }).request("/api/x");
    expect(result).toEqual({ again: true });
    expect(fetchImpl.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("갱신도 실패하면 401 을 던지고 세션 만료를 알린다", async () => {
    const onSessionExpired = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(401, { success: false }))
      .mockResolvedValueOnce(json(401, { success: false })); // refresh 실패
    const error = await createHttp({ fetchImpl, onSessionExpired }).request("/api/x").catch((e) => e);
    expect(error.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("동시에 여러 요청이 401 을 받아도 갱신은 한 번만 한다", async () => {
    // 갱신 요청이 여러 번 나가면 refresh 토큰 회전이 서로를 무효로 만들 수 있다.
    let refreshCalls = 0;
    const fetchImpl = vi.fn(async (path) => {
      if (path === "/api/auth/refresh") {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 5));
        return ok(null);
      }
      // 첫 호출은 401, 재시도는 성공
      return fetchImpl.mock.calls.filter((c) => c[0] === path).length <= 1
        ? json(401, { success: false })
        : ok({ path });
    });
    const http = createHttp({ fetchImpl });
    await Promise.all([http.request("/api/a"), http.request("/api/b"), http.request("/api/c")]);
    expect(refreshCalls).toBe(1);
  });

  it("인증 엔드포인트 자체는 갱신을 시도하지 않는다 — 무한 루프 방지", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(401, { success: false }));
    await createHttp({ fetchImpl }).request("/api/auth/refresh", { method: "POST" }).catch(() => {});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("JSON 이 아닌 502/503/504 는 서버가 깨어나는 중이다 (Railway App Sleeping)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const error = await createHttp({ fetchImpl }).request("/api/x").catch((e) => e);
    expect(error.errorCode).toBe("SERVER_WAKING");
  });

  it("JSON 으로 온 503 은 서버가 준 사유를 지킨다 — 결제 서비스 불가는 '깨어나는 중'이 아니다", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json(503, { success: false, message: "x", errorCode: "STORE_UNAVAILABLE" }),
    );
    const error = await createHttp({ fetchImpl }).request("/api/x").catch((e) => e);
    expect(error.errorCode).toBe("STORE_UNAVAILABLE");
  });

  it("네트워크에 닿지 못하면 NETWORK 로 던진다", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await createHttp({ fetchImpl }).request("/api/x").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.errorCode).toBe("NETWORK");
  });

  it("응답이 제한 시간 안에 안 오면 TIMEOUT 으로 끊는다", async () => {
    const fetchImpl = vi.fn(
      (_path, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const error = await createHttp({ fetchImpl, timeoutMs: 10 }).request("/api/x").catch((e) => e);
    expect(error.errorCode).toBe("TIMEOUT");
  });
});
