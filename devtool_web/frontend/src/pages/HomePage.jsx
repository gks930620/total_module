// SCR-00 홈 — 도구 그리드 (COM-01/02/09)
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TOOLS, groupedTools } from "../lib/tools.js";
import { searchGrouped } from "../lib/search.js";
import { useMeta } from "../lib/useMeta.js";

function ToolCard({ tool }) {
  return (
    <Link to={tool.path} className="tool-card">
      <div className="card-icon">
        <span className="material-icons">{tool.icon}</span>
      </div>
      <div className="card-body">
        <h3>{tool.name}</h3>
        <p>{tool.short}</p>
      </div>
    </Link>
  );
}

export function HomePage() {
  useMeta({
    title: "한국 개발자 유틸 모음 — JSON·JWT·정규식·타임스탬프",
    description:
      "JSON 뷰어, JWT 디코더, 정규식 테스터, 타임스탬프 변환, cron 해석기 등 개발자 도구 22종을 광고 없이 100% 클라이언트 사이드로 제공합니다.",
    path: "/",
    keywords:
      "개발자 유틸, json 포매터, jwt 디코더, 정규식 테스터, 타임스탬프 변환, cron 표현식, uuid 생성기, 해시 생성기",
  });

  const [query, setQuery] = useState("");

  // 검색은 lib/search.js 하나가 맡는다 — 이름이 맞은 것이 태그가 맞은 것보다 앞에 온다.
  // 화면마다 따로 구현하면 어긋난다(생활 상식 검색에서 실제로 그랬다).
  const groups = useMemo(() => searchGrouped(query, groupedTools()), [query]);

  return (
    <div className="home">
      <section className="hero">
        <h1>한국 개발자 유틸 모음</h1>
        <p>
          매일 쓰는 도구 <strong>{TOOLS.length}종</strong>을 <strong>광고 없이</strong>,{" "}
          <strong>100% 브라우저 안에서</strong>, 완전 한국어로. 서버 API도 데이터베이스도 없습니다.
        </p>
        <div className="hero-search">
          <span className="material-icons">search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색 (예: json, 타임스탬프, 최저임금)"
            aria-label="도구 검색"
          />
        </div>
      </section>

      {groups.map((group) => (
        // data-group: 그룹별 아이콘 배지 그라디언트를 CSS에서 고르는 데 쓴다(styles.css)
        <section className="tool-section" data-group={group.key} key={group.key}>
          <h2 className="group-heading">{group.label}</h2>
          <div className="tool-grid" aria-label={group.label}>
            {group.tools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <p className="empty-state">
          &quot;{query}&quot; 와 일치하는 것이 없습니다.
        </p>
      )}
    </div>
  );
}
