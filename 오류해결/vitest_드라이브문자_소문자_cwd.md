# vitest 가 모든 테스트 파일에서 `Cannot read properties of undefined (reading 'config')` 로 실패

> 2026-11-26, businesscard_qr/frontend (vitest 4.1.12, Node 24, Windows)

## 증상
- `npm test` / `npx vitest run` 을 돌리면 **테스트 파일 전부가** 수집 단계에서 같은 오류로 실패한다(내용과 무관 — 최소 테스트도 실패).
  ```
  FAIL  src/lib/__tests__/qr.test.js
  TypeError: Cannot read properties of undefined (reading 'config')
   ❯ describe(...)
  ```
- 같은 명령이 어떤 때는 되고 어떤 때는 안 된다.

## 원인
**작업 폴더 경로의 드라이브 문자가 소문자(`c:\…`)일 때** 생긴다(VSCode 터미널은 `c:\` 로 연다).
vitest 워커는 자기 러너를 `c:/…/node_modules/@vitest/runner` 로 싣는데, 테스트 파일의 `import "vitest"` 는
`C:/…` 로 풀린다. Node 는 둘을 **다른 모듈**로 보고 러너를 두 벌 만들고, 테스트 파일 쪽 러너는 초기화가 안 돼 `config` 가 없다.

확인: 테스트 안에서 `process.cwd()` 가 `c:\…` 이고, `import.meta.resolve("vitest")` 는 `file:///C:/…` 이다.

## 해결
대문자 드라이브로 들어가서 실행한다.
```powershell
Set-Location C:\Users\gks93\workspace\simple_side_success\total_module\businesscard_qr\frontend
npm test
```
- Gradle(`:businesscard_qr:test`)로 돌리면 Gradle 이 경로를 정규화해서(대문자) 이 문제가 없다.
- 코드·설정 문제가 아니다 — 소스를 되돌려도 그대로였다.
