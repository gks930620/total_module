// UTM 링크 만들기·분해 — 전부 클라이언트(NFR-02).

// ── UTM 링크 ───────────────────────────────────────────────

export const UTM_FIELDS = [
  { key: "utm_source", label: "source (필수)", required: true, hint: "유입처. google, naver, newsletter", presets: ["google", "naver", "kakao", "instagram", "facebook", "newsletter", "blog"] },
  { key: "utm_medium", label: "medium (필수)", required: true, hint: "매체. cpc, email, social, referral", presets: ["cpc", "email", "social", "referral", "banner", "post"] },
  { key: "utm_campaign", label: "campaign (필수)", required: true, hint: "캠페인 이름. spring_sale", presets: [] },
  { key: "utm_term", label: "term", required: false, hint: "검색 키워드(유료 검색광고)", presets: [] },
  { key: "utm_content", label: "content", required: false, hint: "같은 캠페인 내 소재 구분. banner_a", presets: [] },
];

/** UTM 파라미터를 붙인 링크를 만든다 */
export function buildUtmUrl(baseUrl, params, { lowercase = true } = {}) {
  const raw = String(baseUrl ?? "").trim();
  if (!raw) return { ok: false, reason: "링크를 입력해 주세요." };

  let url;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: "URL 로 해석할 수 없습니다. 예) https://example.com/page" };
  }

  const missing = UTM_FIELDS.filter((f) => f.required && !String(params?.[f.key] ?? "").trim()).map((f) => f.key);

  for (const f of UTM_FIELDS) {
    const v = String(params?.[f.key] ?? "").trim();
    if (!v) { url.searchParams.delete(f.key); continue; }
    // UTM 값은 대소문자를 구분한다 — 통계가 갈라지지 않도록 소문자로 통일하는 게 관례
    url.searchParams.set(f.key, lowercase ? v.toLowerCase().replace(/\s+/g, "_") : v.replace(/\s+/g, "_"));
  }

  return { ok: true, url: url.toString(), missing, warn: missing.length ? `필수 항목이 비어 있습니다: ${missing.join(", ")}` : null };
}

/** 링크에서 UTM 파라미터를 뽑아낸다(역방향) */
export function parseUtmUrl(input) {
  try {
    const url = new URL(String(input ?? "").trim());
    const params = {};
    for (const f of UTM_FIELDS) {
      const v = url.searchParams.get(f.key);
      if (v !== null) params[f.key] = v;
    }
    // 순회 중에 지우면 항목을 건너뛴다 — 키를 먼저 모아 두고 지운다
    const utmKeys = [...url.searchParams.keys()].filter((k) => k.startsWith("utm_"));
    for (const k of utmKeys) url.searchParams.delete(k);
    return { ok: true, base: url.toString().replace(/\?$/, ""), params, found: Object.keys(params).length };
  } catch {
    return { ok: false, reason: "URL 로 해석할 수 없습니다." };
  }
}

// ── 공유 미리보기(OG) ──────────────────────────────────────

