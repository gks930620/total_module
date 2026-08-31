// 다이어그램 종류와 "예시 넣기" 로 들어가는 본문.
//
// 예시는 **첫인상**이다. 빈 화면에서 시작하면 "뭘 써야 하지" 로 끝나고, 예시가 있으면
// 한 줄 고쳐 보다가 문법을 익힌다. 그래서 장식이 아니라 기능이다.
//
// 예시는 전부 한국 개발 현장에서 실제로 그릴 법한 것으로 쓴다 —
// 외국 튜토리얼의 Alice/Bob 을 옮겨 놓으면 읽는 데 한 번 더 품이 든다.
//
// 여기 적힌 텍스트는 __tests__/diagramMermaidParse.test.js 가 mermaid 진짜 파서로 전부 검사한다.
// 예시가 깨져 있으면 사용자가 처음 보는 화면이 오류 화면이 된다.

/**
 * 종류 하나. 도구 페이지가 이걸 그대로 읽어 화면을 만든다.
 * @typedef {object} DiagramType
 * @property {string} key      내부 식별자
 * @property {string} label    화면에 쓰는 이름
 * @property {string} starts   mermaid 문법의 첫 낱말 (문법 안내에 쓴다)
 * @property {string} hint     "이건 뭘 그리는 건가" 한 줄
 */

export const DIAGRAM_TYPES = [
  { key: "er", label: "ERD", starts: "erDiagram", hint: "테이블과 테이블 사이의 관계. DB 설계를 눈으로 확인할 때." },
  { key: "class", label: "클래스 다이어그램", starts: "classDiagram", hint: "클래스·인터페이스와 상속·연관 관계. 객체 구조를 볼 때." },
  { key: "sequence", label: "시퀀스 다이어그램", starts: "sequenceDiagram", hint: "누가 누구에게 무엇을 언제 보내는가. API 흐름·인증 절차에." },
  { key: "flowchart", label: "순서도", starts: "flowchart TD", hint: "조건과 분기가 있는 처리 흐름. 로직 설명·의사결정에." },
  { key: "state", label: "상태 다이어그램", starts: "stateDiagram-v2", hint: "무엇이 어떤 상태를 오가는가. 주문 상태·결제 단계에." },
  { key: "free", label: "그 밖의 다이어그램", starts: "", hint: "간트·마인드맵·여정·깃그래프 등 나머지 전부." },
];

export const getDiagramType = (key) => DIAGRAM_TYPES.find((t) => t.key === key) || null;

/**
 * @typedef {{type:string, name:string, note?:string, text:string}} DiagramTemplate
 */

/** @type {DiagramTemplate[]} */
export const TEMPLATES = [
  // ── ERD ──
  {
    type: "er", name: "회원 · 주문",
    note: "가장 흔한 1:N. 주문이 회원을 가리킨다.",
    text: `erDiagram
    member ||--o{ orders : "member_id"
    orders ||--o{ order_item : "order_id"

    member {
        bigint id PK
        varchar email UK "필수"
        varchar nickname
        datetime created_at
    }
    orders {
        bigint id PK
        bigint member_id FK
        decimal amount
        varchar status
    }
    order_item {
        bigint id PK
        bigint order_id FK
        varchar name
        int quantity
    }`,
  },
  {
    type: "er", name: "N:M (중간 테이블)",
    note: "다대다는 중간 테이블로 푼다 — DB 에는 N:M 이 직접 없다.",
    text: `erDiagram
    student ||--o{ enrollment : "수강"
    course ||--o{ enrollment : "개설"

    student {
        bigint id PK
        varchar name
    }
    course {
        bigint id PK
        varchar title
    }
    enrollment {
        bigint id PK
        bigint student_id FK
        bigint course_id FK
        date registered_at
    }`,
  },

  // ── 클래스 ──
  {
    type: "class", name: "JPA 엔티티",
    note: "상속(<|--) · 구현(<|..) · 연관(-->) 세 가지 선이 다르다.",
    text: `classDiagram
    class BaseEntity {
        <<abstract>>
        #LocalDateTime createdAt
        #LocalDateTime updatedAt
    }
    class Member {
        -Long id
        -String email
        -List~Order~ orders
        +getEmail() String
        +addOrder(Order o) void
    }
    class Order {
        -Long id
        -Member member
        -OrderStatus status
        +pay(long amount) void
    }
    class Payable {
        <<interface>>
        +pay(long amount) void
    }
    class OrderStatus {
        <<enumeration>>
        +READY
        +PAID
        +CANCELLED
    }

    BaseEntity <|-- Member
    BaseEntity <|-- Order
    Payable <|.. Order
    Member "1" --> "N" Order : OneToMany
    Order --> OrderStatus : status`,
  },
  {
    type: "class", name: "계층 구조 (Controller · Service · Repository)",
    note: "스프링의 흔한 3계층. 화살표는 '이쪽이 저쪽을 쓴다'.",
    text: `classDiagram
    class OrderController {
        -OrderService orderService
        +create(OrderRequest req) OrderResponse
        +findOne(Long id) OrderResponse
    }
    class OrderService {
        -OrderRepository orderRepository
        +create(OrderCommand cmd) Order
        +findById(Long id) Order
    }
    class OrderRepository {
        <<interface>>
        +save(Order o) Order
        +findById(Long id) Optional~Order~
    }
    class Order {
        -Long id
        -BigDecimal amount
    }

    OrderController --> OrderService : 호출
    OrderService --> OrderRepository : 호출
    OrderRepository --> Order : 다룬다`,
  },

  // ── 시퀀스 ──
  {
    type: "sequence", name: "JWT 로그인",
    note: "서버가 토큰을 만들고, 이후 요청은 그 토큰으로 통과한다.",
    text: `sequenceDiagram
    autonumber
    actor U as 사용자
    participant C as 클라이언트
    participant S as 서버
    participant DB as 데이터베이스

    U->>C: 아이디 · 비밀번호 입력
    C->>S: POST /login
    S->>DB: 회원 조회
    DB-->>S: 비밀번호 해시
    S->>S: 해시 비교 · JWT 서명
    S-->>C: 200 { accessToken }
    Note over C: 토큰을 메모리에 보관

    C->>S: GET /orders (Authorization: Bearer ...)
    S->>S: 서명 검증 · 만료 확인
    alt 유효한 토큰
        S-->>C: 200 주문 목록
    else 만료됨
        S-->>C: 401 Unauthorized
    end`,
  },
  {
    type: "sequence", name: "결제 (외부 PG 연동)",
    note: "외부 시스템이 끼면 실패 경로를 반드시 함께 그린다.",
    text: `sequenceDiagram
    participant U as 사용자
    participant S as 우리 서버
    participant PG as 결제사

    U->>S: 결제 요청
    S->>PG: 승인 요청
    alt 승인 성공
        PG-->>S: 승인 번호
        S->>S: 주문 상태 = PAID
        S-->>U: 결제 완료
    else 승인 실패
        PG-->>S: 실패 사유
        S-->>U: 실패 안내
    end
    Note over S,PG: 응답이 없으면 반드시 조회 API 로 확인한다`,
  },

  // ── 순서도 ──
  {
    type: "flowchart", name: "주문 처리",
    note: "마름모{ }가 조건, 대괄호[ ]가 처리, 둥근( )이 시작·끝.",
    text: `flowchart TD
    A([주문 요청]) --> B{재고 있음?}
    B -->|아니오| C[품절 안내]
    C --> Z([종료])
    B -->|예| D[결제 요청]
    D --> E{결제 성공?}
    E -->|아니오| F[주문 취소]
    F --> Z
    E -->|예| G[재고 차감]
    G --> H[주문 확정]
    H --> I[알림 발송]
    I --> Z`,
  },
  {
    type: "flowchart", name: "배포 절차",
    note: "flowchart LR 로 바꾸면 가로로 눕는다.",
    text: `flowchart LR
    A[코드 푸시] --> B[테스트]
    B --> C{통과?}
    C -->|아니오| D[수정]
    D --> A
    C -->|예| E[빌드]
    E --> F[스테이징 배포]
    F --> G{확인 완료?}
    G -->|아니오| D
    G -->|예| H[운영 배포]`,
  },

  // ── 상태 ──
  {
    type: "state", name: "주문 상태",
    note: "[*] 은 시작과 끝. 화살표 뒤 콜론이 '무엇 때문에 넘어가는가'.",
    text: `stateDiagram-v2
    [*] --> 결제대기
    결제대기 --> 결제완료: 결제 승인
    결제대기 --> 취소됨: 사용자 취소
    결제대기 --> 취소됨: 30분 초과
    결제완료 --> 배송중: 발송
    배송중 --> 배송완료: 수령
    결제완료 --> 환불됨: 환불 요청
    배송완료 --> [*]
    취소됨 --> [*]
    환불됨 --> [*]`,
  },
  {
    type: "state", name: "문서 승인 (중첩 상태)",
    note: "state ... { } 로 상태 안에 상태를 넣을 수 있다.",
    text: `stateDiagram-v2
    [*] --> 작성중
    작성중 --> 검토중: 제출
    state 검토중 {
        [*] --> 1차검토
        1차검토 --> 2차검토: 통과
        2차검토 --> [*]
    }
    검토중 --> 승인됨: 최종 승인
    검토중 --> 작성중: 반려
    승인됨 --> [*]`,
  },

  // ── 그 밖 ──
  {
    type: "free", name: "간트 차트 (일정)",
    text: `gantt
    title 프로젝트 일정
    dateFormat YYYY-MM-DD
    axisFormat %m/%d

    section 기획
    요구사항 정리   :done,    a1, 2026-09-01, 5d
    화면 설계       :active,  a2, after a1, 7d

    section 개발
    백엔드          :         b1, after a2, 14d
    프런트          :         b2, after a2, 14d

    section 마무리
    QA              :         c1, after b1, 5d
    배포            :milestone, c2, after c1, 0d`,
  },
  {
    type: "free", name: "마인드맵",
    text: `mindmap
  root((웹 서비스))
    프런트
      React
      상태관리
      번들 크기
    백엔드
      API 설계
      인증
        JWT
        세션
      데이터베이스
    운영
      배포
      모니터링
      백업`,
  },
  {
    type: "free", name: "사용자 여정",
    text: `journey
    title 회원가입 여정
    section 유입
      광고 클릭: 3: 방문자
      첫 화면: 4: 방문자
    section 가입
      약관 동의: 2: 방문자
      정보 입력: 2: 방문자
      이메일 인증: 1: 방문자
    section 첫 사용
      튜토리얼: 4: 회원
      첫 주문: 5: 회원`,
  },
  {
    type: "free", name: "깃 브랜치 흐름",
    text: `gitGraph
    commit id: "초기"
    branch develop
    checkout develop
    commit id: "기능 A"
    branch feature/login
    checkout feature/login
    commit id: "로그인"
    checkout develop
    merge feature/login
    commit id: "기능 B"
    checkout main
    merge develop tag: "v1.0"`,
  },
  {
    type: "free", name: "파이 차트",
    text: `pie title 사용 브라우저
    "Chrome" : 62
    "Safari" : 19
    "Edge" : 11
    "그 외" : 8`,
  },
  {
    type: "free", name: "타임라인 (연혁)",
    text: `timeline
    title 서비스 연혁
    2023 : 기획 시작
         : 팀 구성
    2024 : 베타 공개
         : 첫 유료 고객
    2025 : 정식 출시
    2026 : 해외 진출`,
  },
  {
    type: "free", name: "우선순위 사분면",
    text: `quadrantChart
    title 할 일 우선순위
    x-axis 낮은 노력 --> 높은 노력
    y-axis 낮은 효과 --> 높은 효과
    quadrant-1 바로 한다
    quadrant-2 계획을 세운다
    quadrant-3 나중에
    quadrant-4 하지 않는다
    로그인 개선: [0.3, 0.8]
    다크 모드: [0.2, 0.4]
    결제 연동: [0.8, 0.9]
    관리자 통계: [0.7, 0.3]`,
  },
  {
    type: "free", name: "시스템 구성도 (C4)",
    text: `C4Context
    title 주문 시스템 구성

    Person(user, "사용자", "웹으로 주문한다")
    System(shop, "쇼핑몰", "주문·결제를 처리한다")
    System_Ext(pg, "결제사", "카드 승인")
    SystemDb(db, "데이터베이스", "주문 정보")

    Rel(user, shop, "주문", "HTTPS")
    Rel(shop, pg, "승인 요청", "HTTPS")
    Rel(shop, db, "읽기/쓰기", "JDBC")`,
  },
  {
    type: "free", name: "요구사항 추적",
    note: "이름과 text 는 따옴표로 감싼다 — 안 감싸면 한글에서 문법 오류가 난다.",
    text: `requirementDiagram
    requirement "로그인" {
        id: 1
        text: "사용자는 이메일로 로그인한다"
        risk: medium
        verifymethod: test
    }
    functionalRequirement "토큰 발급" {
        id: 2
        text: "로그인 성공 시 JWT 를 발급한다"
        risk: high
        verifymethod: test
    }
    element "로그인 API" {
        type: "REST"
    }
    "로그인" - contains -> "토큰 발급"
    "로그인 API" - satisfies -> "로그인"`,
  },
  {
    type: "free", name: "XY 차트 (추이)",
    // 축 항목에 한글·기호가 있으면 따옴표로 감싸야 한다
    text: `xychart-beta
    title "월별 가입자"
    x-axis ["1월", "2월", "3월", "4월", "5월", "6월"]
    y-axis "가입자 수" 0 --> 1200
    bar [320, 410, 505, 690, 880, 1050]
    line [320, 410, 505, 690, 880, 1050]`,
  },
];

/** 그 종류의 예시만 골라 준다 */
export const templatesFor = (type) => TEMPLATES.filter((t) => t.type === type);
