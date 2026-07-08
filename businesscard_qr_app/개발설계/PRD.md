# PRD (Product Requirements Document)
## 명함 QR코드 앱

### 1. 프로젝트 개요
**프로젝트명**: 명함 QR코드 앱  
**플랫폼**: Flutter (iOS, Android)  
**목적**: 디지털 명함을 QR코드로 간편하게 공유하고, VCF 파일 및 명함 이미지를 다운로드할 수 있는 앱

---

### 2. 핵심 기능

#### 2.1 사용자 인증
- **카카오 로그인**
  - 카카오 SDK를 사용한 소셜 로그인
  - 자동 로그인 기능 (토큰 유효성 검증)
  - 로그아웃 기능
  - Supabase에 사용자 정보 저장 (id, email, nickname, provider)

#### 2.2 명함 관리
- **명함 목록 조회**
  - 로그인한 사용자의 명함만 표시
  - 표시명 또는 성명으로 목록 표시
  - Pull-to-refresh 기능
  - 새로고침 제한 (1분 쿨다운, 1시간에 10번)
  
- **명함 등록**
  - 필수 정보: 성명, 전화번호
  - 선택 정보: 표시명, 이메일, 웹사이트, 조직/회사, 직책, 주소, 메모
  - 명함 이미지 업로드 (카메라/갤러리)
  - 자동 VCF 파일 생성 및 Storage 업로드
  
- **명함 수정**
  - 기존 명함 정보 수정
  - 명함 이미지 변경
  - 이미지 변경 시 기존 이미지 자동 삭제
  - VCF 파일 자동 재생성
  
- **명함 삭제**
  - Soft delete (is_active = false)

#### 2.3 명함 상세 보기
- **정보 표시**
  - 명함 이미지 (있는 경우)
  - 기본 정보, 연락처 정보, 조직 정보, 주소, 메모
  - 등록일 표시
  
- **QR코드 생성 및 공유**
  - VCF 다운로드 QR코드 (연락처 저장용)
  - 명함 이미지 다운로드 QR코드 (갤러리 저장용)
  - Signed URL 사용 (5분 만료)
  - 다운로드 파일명에 한글 이름 포함

#### 2.4 VCF (vCard) 생성
- **표준 vCard 3.0 형식**
  - FN (성명), ORG (조직), TITLE (직책)
  - TEL (전화번호), EMAIL (이메일), URL (웹사이트)
  - ADR (주소), NOTE (메모)
  - REV (생성일)

#### 2.5 이미지 관리
- **Supabase Storage**
  - 버킷: `business-card`
  - 명함 이미지 경로: `bcimages/cards/{cardId}_card_{timestamp}.{ext}`
  - VCF 파일 경로: `vcards/{cardId}.vcf`
  - 이미지 캐시 서비스 (ImageCacheService)
  - 캐시 무효화를 위한 타임스탬프 사용

---

### 3. 기술 스택

#### 3.1 프론트엔드
- **Framework**: Flutter 3.8.1+
- **주요 패키지**:
  - `supabase_flutter` (^2.10.0): 백엔드 연동
  - `kakao_flutter_sdk` (^1.9.6): 카카오 로그인
  - `qr_flutter` (^4.1.0): QR코드 생성
  - `image_picker` (^1.0.4): 이미지 선택
  - `flutter_dotenv` (^5.1.0): 환경 변수 관리
  - `uuid` (^4.5.1): UUID 생성
  - `path_provider` (^2.1.1): 로컬 파일 경로

#### 3.2 백엔드
- **Supabase**
  - Database: PostgreSQL
  - Storage: 이미지 및 VCF 파일 저장
  - RLS (Row Level Security): 사용자별 데이터 격리

#### 3.3 데이터베이스 스키마
- **테이블**: `business_cards`
  - `id` (UUID, PK)
  - `user_id` (TEXT): 카카오 사용자 ID
  - `full_name` (TEXT, NOT NULL): 성명
  - `display_name` (TEXT): 표시명
  - `phone` (TEXT): 전화번호
  - `email` (TEXT): 이메일
  - `website` (TEXT): 웹사이트
  - `organization` (TEXT): 조직/회사
  - `title` (TEXT): 직책
  - `address` (TEXT): 주소
  - `note` (TEXT): 메모
  - `vcf_download_url` (TEXT): VCF 파일 경로
  - `business_card_image_url` (TEXT): 명함 이미지 URL
  - `is_active` (BOOLEAN): 활성화 상태
  - `view_count` (INTEGER): 조회수
  - `created_at` (TIMESTAMP): 생성일
  - `updated_at` (TIMESTAMP): 수정일

---

### 4. 사용자 흐름

#### 4.1 첫 사용자
1. 앱 실행 → 로그인 화면
2. 카카오 로그인
3. 명함 목록 화면 (비어있음)
4. '명함 추가하기' 버튼 클릭
5. 명함 정보 입력 및 이미지 업로드
6. 저장 → 목록에 추가됨
7. 명함 클릭 → 상세 화면
8. QR코드 생성 → 외부 사용자와 공유

#### 4.2 재방문 사용자
1. 앱 실행 → 자동 로그인 (토큰 유효)
2. 명함 목록 화면 바로 표시
3. 명함 관리 (조회, 수정, 삭제)

#### 4.3 외부 사용자 (명함 수신자)
1. QR코드 스캔
2. Signed URL로 파일 다운로드
3. VCF: 연락처 앱에서 열기 → 저장
4. 이미지: 자동으로 갤러리에 저장

---

### 5. UI/UX 요구사항

#### 5.1 디자인 원칙
- **Material Design 3** 적용
- 세로 모드만 지원 (화면 회전 비활성화)
- 직관적이고 간결한 인터페이스
- 터치 영역 충분히 확보 (버튼 최소 48dp)

#### 5.2 주요 화면
- **로그인 화면**: 카카오 로그인 버튼, 앱 아이콘 및 설명
- **명함 목록 화면**: 명함 카드 리스트, 추가 버튼, 로그아웃/새로고침 버튼
- **명함 등록/수정 화면**: 폼 입력, 이미지 업로드, 저장 버튼
- **명함 상세 화면**: 정보 표시, QR코드 버튼, 수정 버튼

#### 5.3 폰트 크기
- 제목: 22-28pt (Bold)
- 본문: 16-19pt (Medium/SemiBold)
- 버튼: 16-22.4pt (SemiBold)

---

### 6. 보안 요구사항

#### 6.1 인증 및 권한
- 카카오 로그인만 지원 (이메일/비밀번호 로그인 없음)
- 사용자는 자신의 명함만 조회/수정/삭제 가능
- Supabase RLS 정책 적용

#### 6.2 파일 보안
- Signed URL 사용 (5분 만료)
- 파일명에 타임스탬프 추가 (캐시 무효화)
- Private bucket 사용 (public 읽기 제한)

---

### 7. 성능 요구사항

#### 7.1 응답 시간
- 명함 목록 로딩: 2초 이내
- 명함 저장/수정: 3초 이내
- QR코드 생성: 1초 이내

#### 7.2 최적화
- 이미지 캐싱 (로컬 저장소)
- Pull-to-refresh 제한 (1분 쿨다운, 1시간에 10번)
- 불필요한 전체 새로고침 방지 (부분 업데이트)

---

### 8. 향후 개발 계획 (Future Roadmap)

#### 8.1 Phase 2
- [ ] 카카오톡 공유 기능 (VCF, 이미지)
- [ ] 명함 이미지 편집 기능 (크롭, 회전)
- [ ] 명함 템플릿 제공

#### 8.2 Phase 3
- [ ] 결제 기능 (명함 개수 제한 해제)
  - 무료: 최대 3개
  - 프리미엄: 무제한
  - 결제 방식: 월 구독 또는 일회성
- [ ] 통계 기능 (조회수, 다운로드 수)
- [ ] 명함 공유 이력 관리

#### 8.3 Phase 4
- [ ] 다국어 지원 (영어, 일본어, 중국어)
- [ ] 다크 모드 지원
- [ ] NFC 명함 공유 기능

---

### 9. 배포 계획

#### 9.1 환경 설정
- `.env` 파일로 환경 변수 관리
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `KAKAO_NATIVE_APP_KEY`

#### 9.2 플랫폼별 배포
- **Android**: Google Play Store
  - minSdkVersion: 21 (Android 5.0)
  - targetSdkVersion: 34 (Android 14)
  - Gradle 8.3.0
  - Kotlin 1.9.0
  
- **iOS**: Apple App Store
  - iOS 12.0 이상

---

### 10. 테스트 계획

#### 10.1 단위 테스트
- [ ] VCardGenerator 테스트
- [ ] BusinessCardService 테스트
- [ ] ImageCacheService 테스트

#### 10.2 통합 테스트
- [ ] 카카오 로그인 플로우
- [ ] 명함 CRUD 플로우
- [ ] QR코드 생성 및 다운로드 플로우

#### 10.3 UI 테스트
- [ ] 화면 네비게이션 테스트
- [ ] 폼 입력 유효성 검증
- [ ] 이미지 업로드 테스트

---

### 11. 문제 및 제약사항

#### 11.1 현재 알려진 이슈
- ~~Edge Function 사용 불가 (Signed URL로 대체)~~
- 명함 저장/수정 후 즉시 반영 안됨 → 해결 필요
- 이미지 선택 취소 기능 없음 → UI 개선 필요
- 프로필 이미지 기능 미사용 (명함 이미지만 사용)

#### 11.2 제약사항
- Supabase `auth.users` 테이블은 UUID 타입 고정
- 카카오 로그인만 지원 (다른 소셜 로그인 없음)
- 세로 모드만 지원 (가로 모드 비활성화)

---

### 12. 참고 문서
- [Supabase 공식 문서](https://supabase.com/docs)
- [Kakao Flutter SDK](https://developers.kakao.com/docs/latest/ko/sdk-download/flutter)
- [vCard 3.0 표준](https://www.rfc-editor.org/rfc/rfc2426)

