// 명함QR 서비스워커 — 설계 웹앱_전환_설계.md §6.
//
// 캐시하는 것: **앱 셸**(HTML·JS·CSS·아이콘)뿐. 그래서 오프라인에서도 화면 틀은 뜨고, 홈 화면 설치가 된다.
// 캐시하지 않는 것: /api/**, /uploads/** — 명함 데이터와 사진.
//   다른 기기에서 고친 명함을 낡은 캐시로 보여주면 안 되고(앱의 캐시 전략 메모와 같은 판단),
//   로그인한 사람의 데이터가 기기에 남는 것도 피한다.
//
// 이 파일을 고치면 VERSION 을 올린다 — 브라우저는 sw.js 내용이 바뀌어야 새 워커를 설치한다.
const VERSION = "bq-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/** 해시가 붙은 번들은 배포마다 이름이 바뀐다. 옛것이 무한히 쌓이지 않게 개수를 묶는다. */
const MAX_ASSET_ENTRIES = 60;

const SHELL = ["/index.html", "/design-kit/design-kit.css", "/icons/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 카카오맵 등 외부는 건드리지 않는다

  // 데이터와 로그인 흐름은 항상 네트워크로. (respondWith 를 안 부르면 브라우저가 평소대로 처리한다)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request, url));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

/**
 * 화면 이동은 **네트워크 우선**. 온라인이면 항상 최신 HTML(=최신 번들 이름)을 받아
 * 배포가 바로 반영된다. 오프라인일 때만 캐시해 둔 셸로 띄운다.
 */
async function navigate(request, url) {
  try {
    const response = await fetch(request);
    // SPA 경로(/cards, /pro 등)의 응답은 모두 같은 index.html 이다 — 하나로만 저장해 둔다.
    // 덮어쓰지 않는 것:
    //  - /privacy.html 같은 별도 문서 — 셸이 아니다.
    //  - /c/… 공개 명함 — 서버가 "누구의 명함인지" 미리보기 태그(제목 = 남의 이름)를 끼워 넣은 HTML 이다.
    //    셸로 저장하면 오프라인에서 내 화면 제목이 남의 이름으로 뜬다.
    if (response.ok && !url.pathname.endsWith(".html") && !url.pathname.startsWith("/c/")) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const cached = (await caches.match(request)) || (await caches.match("/index.html"));
    return cached || Response.error();
  }
}

/** 해시 붙은 번들은 내용이 절대 안 바뀐다 — 캐시에 있으면 그대로 쓴다. */
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // 서버가 깨어나는 중의 502 같은 오류 응답은 저장하지 않는다 — 저장하면 계속 깨진 화면이 뜬다.
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

/** 킷 CSS·아이콘·manifest — 일단 캐시로 빨리 보여주고 뒤에서 새로 받아 둔다. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || network;
}

async function trim(cache) {
  const keys = await cache.keys();
  // keys() 는 넣은 순서다 — 앞쪽(오래된 것)부터 지운다.
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSET_ENTRIES))) {
    await cache.delete(key);
  }
}
