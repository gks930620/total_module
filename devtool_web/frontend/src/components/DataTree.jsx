// 데이터 트리 뷰 + 가상 스크롤 + 키/값 검색.
// 입력: flat = lib/dataView.js 의 flattenValue 산출. 형식과 무관하다 —
// JSON 이든 YAML 이든 CSV 든 읽어낸 값의 모양만 보므로 뷰어 하나로 전부 본다.
// 접힘 상태를 관리하며 보이는 행만 DOM 에 그린다(수만 행에서도 스크롤이 끊기지 않는다).
//
// 검색 UI를 이 컴포넌트가 직접 소유한다 — 부모와 상태를 주고받으면 effect 로 동기화해야 하고
// 그러면 렌더가 연쇄된다. 검색·이동에 필요한 정보(visible 목록·스크롤 컨테이너)가 전부
// 여기 있으므로 여기 두는 편이 단순하다.
import { useMemo, useState, useRef, useCallback } from "react";

const ROW_HEIGHT = 24; // px
const OVERSCAN = 12;

const SEARCH_TARGETS = [
  { key: "all", label: "전체" },
  { key: "key", label: "키만" },
  { key: "value", label: "값만" },
  { key: "path", label: "경로만" },
];

export function DataTree({ flat }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState("all");
  // 검색어가 바뀌면 커서를 0으로 되돌려야 한다. effect 로 setState 하는 대신
  // "어떤 검색에 대한 커서인지"를 함께 저장해 렌더 중에 판별한다(연쇄 렌더 없음).
  const [cursorState, setCursorState] = useState({ key: "", index: 0 });
  const containerRef = useRef(null);

  const searchKey = `${search}\u0000${target}`;
  const cursor = cursorState.key === searchKey ? cursorState.index : 0;

  // 검색 일치 노드 집합 (JSN-06)
  const matchIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set();
    for (const node of flat) {
      const key = node.key === null ? "" : String(node.key).toLowerCase();
      const value = String(node.preview ?? "").toLowerCase();
      const path = String(node.path ?? "").toLowerCase();
      const hit =
        target === "key" ? key.includes(q)
          : target === "value" ? value.includes(q)
            : target === "path" ? path.includes(q)
              : key.includes(q) || value.includes(q) || path.includes(q);
      if (hit) ids.add(node.id);
    }
    return ids;
  }, [flat, search, target]);

  // 일치 노드가 접힌 조상 아래 숨어 있으면 찾을 수 없으므로, 검색 중에는 접힘을 무시한다.
  const searching = matchIds !== null && matchIds.size > 0;

  // 접힌 노드의 자식을 제외한 "보이는 노드" 목록 계산
  const visible = useMemo(() => {
    const result = [];
    let skipDepth = null; // 이 depth보다 깊은 노드는 숨김
    for (let i = 0; i < flat.length; i++) {
      const node = flat[i];
      if (skipDepth !== null) {
        if (node.depth > skipDepth) continue;
        skipDepth = null;
      }
      result.push(node);
      if (!searching && node.hasChildren && collapsed.has(node.id)) {
        skipDepth = node.depth;
      }
    }
    return result;
  }, [flat, collapsed, searching]);

  // 일치 노드의 화면상 위치 목록 — 이전/다음 이동에 쓴다
  const matchPositions = useMemo(() => {
    if (!matchIds) return [];
    const out = [];
    visible.forEach((node, index) => {
      if (matchIds.has(node.id)) out.push(index);
    });
    return out;
  }, [visible, matchIds]);

  const activeIndex = matchPositions.length
    ? matchPositions[Math.min(cursor, matchPositions.length - 1)]
    : -1;

  const goTo = (delta) => {
    if (!matchPositions.length) return;
    const next = (cursor + delta + matchPositions.length) % matchPositions.length;
    setCursorState({ key: searchKey, index: next });
    const el = containerRef.current;
    if (el) el.scrollTop = Math.max(0, matchPositions[next] * ROW_HEIGHT - el.clientHeight / 2);
  };

  const toggle = useCallback((id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const setContainer = useCallback((el) => {
    containerRef.current = el;
    if (el) setViewportH(el.clientHeight || 480);
  }, []);

  const total = visible.length;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN);
  const slice = visible.slice(startIdx, endIdx);

  return (
    <>
      <div className="tree-search">
        <span className="material-icons">search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="키 · 값 · 경로 검색"
          aria-label="JSON 검색"
        />
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="검색 대상">
          {SEARCH_TARGETS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        {search.trim() !== "" && (
          <>
            <span className="match-count">
              {matchPositions.length > 0
                ? `${Math.min(cursor, matchPositions.length - 1) + 1} / ${matchPositions.length}`
                : "0건"}
            </span>
            <button type="button" className="btn icon" onClick={() => goTo(-1)} disabled={!matchPositions.length} aria-label="이전 일치">
              <span className="material-icons">keyboard_arrow_up</span>
            </button>
            <button type="button" className="btn icon" onClick={() => goTo(1)} disabled={!matchPositions.length} aria-label="다음 일치">
              <span className="material-icons">keyboard_arrow_down</span>
            </button>
          </>
        )}
      </div>

      <div className="json-tree" ref={setContainer} onScroll={onScroll}>
        <div style={{ height: total * ROW_HEIGHT, position: "relative" }}>
          {slice.map((node, i) => {
            const idx = startIdx + i;
            const isCollapsed = !searching && collapsed.has(node.id);
            const isMatch = matchIds ? matchIds.has(node.id) : false;
            const isActive = idx === activeIndex;
            return (
              <div
                key={node.id}
                className={`tree-row${isMatch ? " match" : ""}${isActive ? " active-match" : ""}`}
                style={{
                  position: "absolute",
                  top: idx * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  paddingLeft: node.depth * 16 + 8,
                }}
              >
                {node.hasChildren ? (
                  <button
                    type="button"
                    className="tree-toggle"
                    onClick={() => toggle(node.id)}
                    aria-label={isCollapsed ? "펼치기" : "접기"}
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                ) : (
                  <span className="tree-toggle placeholder" />
                )}
                {node.key !== null && (
                  <span className={`tree-key ${typeof node.key === "number" ? "idx" : ""}`}>
                    {typeof node.key === "number" ? node.key : `"${node.key}"`}
                    <span className="tree-colon">:</span>
                  </span>
                )}
                <span className={`tree-val kind-${node.kind}`}>{node.preview}</span>
                {node.hasChildren && isCollapsed && (
                  <span className="tree-count">
                    {node.kind === "array" ? `${node.childCount}개 항목` : `${node.childCount}개 키`}
                  </span>
                )}
                {isMatch && node.path && <span className="tree-path" title="JSON 경로">{node.path}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
