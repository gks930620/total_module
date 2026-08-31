// 도구 화면 공통 헤더: 아이콘 + h1 + 한 줄 설명 (화면설계 §2)
//
// 시안 J: 도구 아이콘을 그라디언트 배지로 앞에 둔다.
// 아이콘은 페이지가 넘겨주지 않고 현재 경로로 도구 레지스트리에서 찾는다 —
// 페이지를 전부 고치지 않아도 되고, tools.js 가 단일 출처로 유지된다.
import { useLocation } from "react-router-dom";
import { getToolByPath } from "../lib/tools.js";

export function ToolHeader({ title, description, icon }) {
  const { pathname } = useLocation();
  // icon prop 이 있으면 그것을, 없으면 경로로 찾은 도구의 아이콘을 쓴다
  const resolved = icon || getToolByPath(pathname)?.icon || "build";

  return (
    <div className="tool-header">
      <span className="tool-avatar" aria-hidden="true">
        <span className="material-icons">{resolved}</span>
      </span>
      <div>
        <h1>{title}</h1>
        {description && <p className="tool-desc">{description}</p>}
      </div>
    </div>
  );
}
