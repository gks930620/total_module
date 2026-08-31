// 도구 검색 — 홈과 사이드바가 함께 쓴다.
//
// 왜 점수를 매기나: 개념 태그를 넉넉히 넣으면 한 검색어에 여러 도구가 걸린다.
// 그때 **이름이 맞은 것이 태그가 맞은 것보다 앞에** 와야 검색이 쓸모 있다.
// 부분일치만 하고 순서를 안 정하면, 태그를 늘릴수록 검색이 나빠진다.
//
// 화면 두 곳이 각자 구현하면 어긋난다 — 생활 상식 검색에서 실제로 그랬다(filterGuides 참조).
// 그래서 여기 하나만 둔다.

import { TOOLS } from "./tools.js";

/** 어디서 맞았느냐에 따른 가중치. 이름 > 슬러그 > 요약 > 키워드 > 태그. */
const FIELDS = [
  ["name", 100],
  ["slug", 80],
  ["short", 45],
  ["keywords", 25],
  ["tags", 15],
];

/** 검색어를 낱말로 나눈다. 여러 낱말은 **전부** 걸려야 한다(AND). */
const tokenize = (q) => String(q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * 낱말 하나가 도구에 얼마나 잘 맞는지. 안 맞으면 0.
 * 같은 칸에서도 **앞에서부터 맞은 것**과 **낱말 전체가 맞은 것**을 더 높이 친다.
 */
function scoreToken(tool, token) {
  let best = 0;
  for (const [field, weight] of FIELDS) {
    const value = String(tool[field] ?? "").toLowerCase();
    if (!value) continue;
    const at = value.indexOf(token);
    if (at < 0) continue;

    let s = weight;
    // 칸 전체가 그 낱말이면 확실한 의도다 ("qr" → QR 코드)
    if (value === token) s += weight;
    // 낱말 경계에서 시작하면 우연한 부분일치보다 낫다
    else if (at === 0 || /[\s,·]/.test(value[at - 1])) s += weight * 0.5;

    if (s > best) best = s;
  }
  return best;
}

/**
 * 도구를 검색한다.
 *
 * @param {string} query 검색어. 비면 전부 원래 순서로 돌려준다.
 * @param {Array} [list] 대상 목록(테스트용). 기본은 TOOLS.
 * @returns {Array} 점수 높은 순. 점수가 같으면 원래 순서.
 */
export function searchTools(query, list = TOOLS) {
  const tokens = tokenize(query);
  if (!tokens.length) return [...list];

  const hits = [];
  list.forEach((tool, index) => {
    let total = 0;
    for (const token of tokens) {
      const s = scoreToken(tool, token);
      if (!s) return;          // 한 낱말이라도 없으면 탈락
      total += s;
    }
    hits.push({ tool, total, index });
  });

  hits.sort((a, b) => b.total - a.total || a.index - b.index);
  return hits.map((h) => h.tool);
}

/** 검색 결과를 그룹별로 다시 묶는다 — 홈과 사이드바가 그룹 단위로 그리기 때문이다. */
export function searchGrouped(query, groups) {
  const found = searchTools(query);
  const rank = new Map(found.map((t, i) => [t.slug, i]));
  return groups
    .map((g) => ({
      ...g,
      tools: g.tools.filter((t) => rank.has(t.slug)).sort((a, b) => rank.get(a.slug) - rank.get(b.slug)),
    }))
    .filter((g) => g.tools.length > 0);
}
