// erd — 화면은 components/DiagramTool.jsx 하나를 함께 쓴다.
// 종류마다 페이지를 따로 두는 이유는 검색이다("ERD 그리기" 와 "시퀀스 다이어그램" 은 다른 검색어).
import { DiagramTool } from "../components/DiagramTool.jsx";
import { getToolBySlug } from "../lib/tools.js";

const tool = getToolBySlug("erd");

const GUIDE = {
  intro: "CREATE TABLE 문을 왼쪽에 통째로 붙여넣고 '그림으로 만들기' 를 누르면 테이블·컬럼·외래키를 읽어 ERD 를 그립니다. 그린 뒤 '직접 쓰기' 로 넘어가 손으로 고칠 수도 있습니다.",
  screen: {
    layout: "split",
    left: { head: "SQL 붙여넣기 / 직접 쓰기", body: "CREATE TABLE 문 그대로", action: "그림으로 만들기" },
    right: { head: "미리보기", body: "확대·축소 · SVG 저장 · PNG 저장" },
    caption: "읽어낸 테이블 수와 이은 관계 수를 왼쪽 아래에서 알려 줍니다.",
  },
  example: {
    in: `CREATE TABLE member (
  id BIGINT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE
);
CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  member_id BIGINT REFERENCES member(id)
);`,
    out: `member ─── 1:N ─── orders
  id     PK          id         PK
  email  UNIQUE      member_id  FK`,
    outLabel: "나오는 그림",
  },
  notes: [
    "'그리기' 탭에서는 문법 없이 마우스로 직접 그립니다 — 상자를 놓고, 오른쪽 점을 끌어 연결하고, 내용은 옆 패널에서 고칩니다. 그림은 이 브라우저에 자동 저장되고 SVG·PNG·JSON 으로 내보낼 수 있습니다.",
    "코드에서 읽은 결과는 '그리기로 보내기' 로 캔버스에 옮겨 손으로 이어서 편집할 수 있습니다.",
    "FOREIGN KEY · REFERENCES · ALTER TABLE 로 붙인 외래키까지 읽어 관계선을 잇습니다. MySQL 백틱 · PostgreSQL 큰따옴표 · SQL Server 대괄호를 모두 벗겨 냅니다.",
    "컬럼 줄에 쓴 PRIMARY KEY 와 테이블 끝에 몰아 쓴 PRIMARY KEY (id) 를 둘 다 읽고, NOT NULL 은 '필수' 로 표시합니다.",
    "정의가 없는 테이블을 가리키는 FK 는 선을 잇지 않고 알려만 줍니다 — 없는 상자를 향한 화살표는 그림이 거짓말을 하는 것이기 때문입니다. 참조 대상의 CREATE TABLE 도 함께 붙여넣으면 이어집니다.",
    "JPA 엔티티에서 시작한다면 클래스 다이어그램 도구가 더 맞습니다. DB 스키마 기준이면 이 도구를, 객체 기준이면 그쪽을 쓰세요.",
    "파싱도 그리기도 전부 브라우저 안에서 끝납니다 — 이 사이트에는 데이터를 받을 서버 API 자체가 없습니다.",
  ],
};

export function ErdPage() {
  return (
    <DiagramTool
      tool={tool}
      type="er"
      guide={GUIDE}
      intro="CREATE TABLE 문을 그대로 붙여넣으면 테이블·컬럼·외래키를 읽어 ERD 를 그립니다."
    />
  );
}
