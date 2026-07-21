# total_module — 풀스택 통합 배포 프로젝트

로컬에서 완성한 사이드 프로젝트들을 **하나의 Railway 프로젝트로 통합 배포**하는 모노레포입니다.
Flutter 앱 + Spring Boot 백엔드 + React 웹으로 이루어져 있고,
**실제 회사 조직처럼** 역할을 나눈 에이전트 팀이 기획 → 설계 → 구현 → 검증 → 배포 파이프라인으로 일합니다.

## 제품 개요

- **무엇을 만드나**: 검증된 개인 사이드 프로젝트들을 모아 Railway 하나로 저비용 운영하는 통합 저장소.
  현재 입주 프로젝트: **businesscard_qr**(명함을 QR로 공유하는 앱+API), **doll_gacha**(인형뽑기 가게 지도·리뷰·커뮤니티 웹).
- **사용자는 누구인가**: 개발자 본인 + 지인/소규모 일반 사용자 (트래픽 거의 없음 — 비용 최적화가 중요).

## 스택 / 저장소 구조

| 영역 | 스택 | 경로 | 테스트 명령 |
|---|---|---|---|
| 백엔드 | Spring Boot 3.3 / Java 17 (Gradle 멀티모듈) | `businesscard_qr/`, `doll_gacha/` (모듈 = Railway 서비스) | `.\gradlew.bat --no-daemon :<모듈>:test` ⚠️ 아래 JAVA_HOME 필수 |
| 웹 | React (JS, Vite) — doll_gacha 에 내장(스프링이 정적 서빙) | `doll_gacha/frontend/` | `.\gradlew.bat :doll_gacha:npmBuild` (vite build. 별도 npm test 없음) |
| 앱 | Flutter (Dart) — Gradle 멤버 아님, APK 별도 배포 | `businesscard_qr_app/` | `flutter analyze` (SDK: `C:\Users\gks93\tools\flutter`) |
| 배포 | Railway | 절차: `.claude/skills/railway-deploy/SKILL.md` | — |

⚠️ **java 가 PATH 에 없다.** Gradle 실행 전에 반드시:
```powershell
$env:JAVA_HOME = "C:\Users\gks93\.jdks\corretto-17.0.19"; $env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

## 팀 구조 (회사 조직)

| 에이전트 | 역할 | 수정 권한 |
|---|---|---|
| `product-planner` | 기획자 — 사용자 관점 동작 흐름·인수 조건 정의, 기획 문서 관리 | 문서만 |
| `designer` | 디자이너 — 화면 정의서(상태별 UI 포함)·디자인 토큰 관리 | 문서·토큰만 |
| `senior-dev` | 선임개발자(테크 리드) — ERD·API 명세서 작성, TDD 테스트 선작성, 개발 중 코드리뷰, 기술 결정 | O |
| `backend-dev` | 백엔드개발자 — Spring Boot 구현 | O (백엔드만) |
| `frontend-dev` | 프론트개발자 — React 웹 구현 | O (웹만) |
| `app-dev` | 앱개발자 — Flutter 앱 구현 | O (앱만) |
| `qa` | QA — 기획서로 테스트 케이스 설계, 실제 제품을 시나리오로 시험(경계·비정상·탐색·회귀) | X |
| `devops` | CI/CD — git·GitHub Actions·Railway 배포 | O (설정·워크플로만) |
| `builder` *(공통)* | 스택에 안 걸리는 잡일(스크립트·설정·문서). 세 개발자 영역 밖의 폴백 | O |

> 공통 planner/reviewer/researcher는 뺐다 — 기획은 product-planner·senior-dev가, 코드 검토는
> senior-dev·qa가 이미 맡아서 겹치기 때문. 필요해지면 최상위 `.claude/agents/`에서 파일만 가져오면 된다.

## 일하는 흐름 (파이프라인)

```
product-planner(사용자 흐름·인수 조건) → designer(화면 정의서)
→ senior-dev(기획서에서 API 명세서 도출 + ERD + 명세 기반 테스트 선작성 = Red)
→ backend-dev ∥ frontend-dev ∥ app-dev   (테스트를 통과시키며 병렬 구현 = Green)
→ senior-dev(개발 중 코드리뷰 — 컨벤션·클린코드·스택 간 정합성, 수정은 개발자가)
→ qa(테스트 케이스 설계·시나리오 시험) — 결함은 해당 개발자로 되돌림
→ devops(커밋·배포)
```

## 작업 방식 (TDD — 이 프로젝트의 핵심 규칙)

**항상 TDD다. 프로덕션 코드보다 테스트 코드가 먼저다. 예외 없음.**

1. **테스트가 명세다** — senior-dev가 API 계약·화면 요구를 테스트 코드로 먼저 작성한다(실패 상태 = Red). 테스트 없이 개발자에게 일을 넘기지 않는다.
2. **개발자는 테스트를 통과시킨다(Green)** — senior-dev의 테스트 수정 금지. 테스트가 틀렸다고 판단되면 senior-dev에게 되돌린다.
3. **테스트에 없는 코드가 필요해지면** — 계약·공개 동작은 senior-dev에게 테스트 추가를 요청하고, 내부 구현 세부는 개발자가 직접 테스트를 먼저 작성(실패 확인)한 뒤 구현한다. 어떤 경우에도 순서는 테스트 → 코드다.
4. **계약 밖 변경 금지** — API 응답 필드를 임의로 추가/변경하면 다른 스택이 깨진다. 계약 변경은 senior-dev를 통해서만.
5. **qa 통과가 완료 조건** — qa는 개발자 테스트를 재실행하는 게 아니라, 기획서로 테스트 케이스를 설계해 실제 제품을 시험하는 독립 관문이다. 테스트 없이 들어온 프로덕션 코드는 qa가 결함으로 리포트한다.

## 문서 위치

- **전체 설계·배포·컨벤션**: `total_설계/` — `아키텍처_및_편입기준.md`(구조·새 모듈 편입 기준), `railway_배포_및_비용.md`(배포·비용), `코드컨벤션.md`
- **모듈별 설계**: `<모듈>/설계/` (예: `businesscard_qr/설계/`)
- **작업 기록**: `오류해결/`(문제 진단·해결 기록), `기억할거/`(모듈별 기억할 메모 — 캐시 전략, DB 잔여 컬럼, 배포·운영 현황 등)
- 기획서·화면 정의서: 아직 없음 — 새로 만들면 `docs/기획/`, `docs/화면정의/` 에 (product-planner / designer 담당)
- API 명세서·ERD: 아직 별도 문서 없음 — senior-dev 가 만들면 `<모듈>/설계/` 에 (세 스택과 qa가 공유하는 단일 기준)
- 디자인 토큰: 아직 없음 (웹은 페이지별 인라인 CSS 상태)

## 이 프로젝트의 규칙

- **커밋·푸시·배포는 사용자가 명시적으로 요청할 때만** — 실행은 devops 담당.
- **배포 전 조건**: 세 스택 테스트 통과 + qa 판정 통과. 절차는 railway-deploy 스킬.
- **새 라이브러리 도입은 senior-dev 결정 사항** — 개발자가 임의로 추가하지 않는다.
- **코드 컨벤션**: `code-convention` 스킬이 기준이다 (DTO class 규칙, 계층 구조, 백엔드 테스트는 컨트롤러 통합테스트만 등). 문서와 코드가 어긋나면 문서에 맞춰 코드를 고친다.
- **금지**: 요청받지 않은 대규모 리팩터링, 자기 영역 밖 스택의 코드 수정.
