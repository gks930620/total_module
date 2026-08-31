// 정규식 테스터 유틸 (RGX-01~03) — 전부 클라이언트, 서버 전송 없음(NFR-02).
// 핵심 안전장치: 제로 길이 매치의 lastIndex 강제 전진(무한루프 방지) + 매치 상한(truncated).

const DEFAULT_MAX_MATCHES = 1000;

// 패턴+플래그 컴파일. 오류 시 regex=null + 한국어 안내(RGX-01 오류 인라인).
export function compileRegex(pattern, flags) {
  try {
    return { regex: new RegExp(pattern, flags), error: null };
  } catch (e) {
    return { regex: null, error: `정규식 문법 오류: ${e.message}` };
  }
}

// 매치 목록 (RGX-01/02). g 플래그가 없으면 첫 매치만.
export function findMatches(pattern, flags, text, { maxMatches = DEFAULT_MAX_MATCHES } = {}) {
  const { regex, error } = compileRegex(pattern, flags);
  if (error) {
    return { matches: [], error, truncated: false };
  }

  const matches = [];
  let truncated = false;

  if (!regex.global) {
    const m = regex.exec(text);
    if (m) matches.push(toMatch(m, 0));
    return { matches, error: null, truncated };
  }

  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    matches.push(toMatch(m, matches.length));
    // 제로 길이 매치는 lastIndex 가 전진하지 않아 무한루프가 된다 → 1 전진
    if (m[0] === "") {
      regex.lastIndex += 1;
    }
  }
  return { matches, error: null, truncated };
}

function toMatch(m, index) {
  return {
    index,
    start: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: m.length > 1 ? m.slice(1) : [],
    namedGroups: m.groups ? { ...m.groups } : null,
  };
}

// 하이라이트 렌더용 구간 분할: 비매치 { text, matched:false } / 매치 { text, matched:true, matchIndex }
export function buildSegments(text, matches) {
  if (!matches || matches.length === 0) {
    return [{ text, matched: false }];
  }
  const segments = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ text: text.slice(cursor, m.start), matched: false });
    }
    if (m.end > m.start) {
      segments.push({ text: text.slice(m.start, m.end), matched: true, matchIndex: m.index });
      cursor = m.end;
    }
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}

// 한국 특화 프리셋 (RGX-03). sample 은 칩 클릭 시 채워지는 데모 문자열.
export const REGEX_PRESETS = [
  {
    key: "phone",
    label: "휴대폰번호",
    pattern: "01[016789]-?\\d{3,4}-?\\d{4}",
    sample: "담당자: 010-1234-5678 / 예비: 01198765432",
  },
  {
    key: "email",
    label: "이메일",
    pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+",
    sample: "문의는 dev@example.com 또는 admin+tools@my-site.co.kr 로 주세요.",
  },
  {
    key: "bizno",
    label: "사업자번호",
    pattern: "\\d{3}-?\\d{2}-?\\d{5}",
    sample: "사업자등록번호 120-81-47521 (하이픈 없이 1208147521 도 매치)",
  },
  {
    key: "zipcode",
    label: "우편번호",
    pattern: "\\b\\d{5}\\b",
    sample: "서울특별시 중구 세종대로 110 (우편번호 04524)",
  },
  {
    // 나머지 넷과 같은 **추출형**이다(문장에서 찾아내기).
    // 검증형 ^[가-힣]+$ 로 두면 글자 하나만 고쳐도 매치가 0 이 돼서 고장난 것처럼 보인다.
    // 검증형이 필요하면 앞뒤에 ^ $ 를 붙이면 된다 — 그 안내는 화면 하단 사용법에 있다.
    key: "hangul",
    label: "한글만",
    pattern: "[가-힣]+",
    sample: "한글만 골라내기 ㅋㅋ English 123 초성ㅎ",
  },
];
