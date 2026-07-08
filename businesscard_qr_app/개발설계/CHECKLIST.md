# 명함 QR코드 앱 - 개발 체크리스트

> 📅 최종 업데이트: 2025-11-06  
> 🎯 프로젝트: 명함 QR코드 앱 (Flutter)

---

## 📋 프로젝트 설정
- [x] Flutter 프로젝트 생성
- [x] pubspec.yaml 패키지 설정
  - [x] supabase_flutter (^2.10.0)
  - [x] kakao_flutter_sdk (^1.9.6)
  - [x] qr_flutter (^4.1.0)
  - [x] image_picker (^1.0.4)
  - [x] flutter_dotenv (^5.1.0)
  - [x] uuid (^4.5.1)
  - [x] path_provider (^2.1.1)
  - [x] crypto (^3.0.3)
- [x] .env 파일 생성 및 환경 변수 설정
  - [x] SUPABASE_URL
  - [x] SUPABASE_ANON_KEY
  - [x] KAKAO_NATIVE_APP_KEY
- [x] Android 설정
  - [x] Gradle 8.3.0
  - [x] Kotlin 1.9.0
  - [x] minSdkVersion 21
- [x] iOS 설정
  - [x] iOS 12.0 이상
- [x] 화면 회전 비활성화 (세로 모드만)
- [x] Material Design 3 테마 적용

---

## 🔐 1. 사용자 인증

### 1.1 카카오 로그인
- [x] 카카오 SDK 초기화 (main.dart)
- [x] 카카오톡으로 로그인
- [x] 카카오 계정으로 로그인
- [x] 로그인 화면 UI
  - [x] 앱 아이콘 및 설명
  - [x] 카카오 로그인 버튼

### 1.2 자동 로그인
- [x] 앱 시작 시 토큰 유효성 검증
- [x] 유효한 토큰 있으면 명함 목록으로 자동 이동
- [x] 로그인 체크 중 로딩 표시

### 1.3 로그아웃
- [x] 로그아웃 버튼 (AppBar)
- [x] 로그아웃 확인 다이얼로그
- [x] 카카오 로그아웃 처리
- [x] 로그인 화면으로 이동

### 1.4 Supabase 사용자 관리
- [x] users 테이블에 사용자 정보 저장 (upsert)
- [x] 카카오 사용자 ID, 이메일, 닉네임, provider 저장

---

## 📇 2. 명함 관리 (CRUD)

### 2.1 명함 목록 조회 (List)
- [x] 현재 로그인 사용자의 명함만 조회
- [x] is_active = true 필터링
- [x] created_at 내림차순 정렬
- [x] 명함 목록 UI
  - [x] 표시명 또는 성명 표시
  - [x] 카드 형태 리스트
  - [x] 빈 목록 안내 메시지
- [x] Pull-to-refresh 기능
- [x] 새로고침 제한
  - [x] 1분 쿨다운
  - [x] 1시간에 10번 제한
- [x] 명함 추가 버튼 (40% 크기 증가)
- [x] AppBar 버튼
  - [x] 로그아웃
  - [x] 새로고침

### 2.2 명함 등록 (Create)
- [x] 명함 등록 폼 UI
  - [x] 명함 이미지 업로드 섹션 (최상단)
    - [x] 카메라 촬영
    - [x] 갤러리 선택
    - [x] 이미지 미리보기
    - [x] 이미지 변경 버튼
  - [x] 기본 정보 섹션
    - [x] 표시명 (선택, 헬퍼 텍스트)
    - [x] 성명 (필수)
  - [x] 연락처 정보 섹션
    - [x] 전화번호 (필수, 숫자 키보드)
    - [x] 이메일 (선택, 이메일 키보드)
    - [x] 웹사이트 (선택, URL 키보드)
  - [x] 조직 정보 섹션
    - [x] 조직/회사 (선택)
    - [x] 직책 (선택)
  - [x] 주소 정보 섹션
    - [x] 주소 (선택, 2줄)
  - [x] 추가 정보 섹션
    - [x] 메모 (선택, 3줄)
- [x] 폼 유효성 검증
  - [x] 성명 필수 체크
  - [x] 전화번호 필수 체크
- [x] 명함 저장 로직
  - [x] 현재 사용자 ID 자동 설정
  - [x] 명함 이미지 Storage 업로드 (타임스탬프 포함)
  - [x] VCF 파일 자동 생성
  - [x] VCF 파일 Storage 업로드
  - [x] business_cards 테이블에 저장 (upsert)
- [x] 저장 후 처리
  - [x] 저장 성공 메시지
  - [x] 새 명함 ID 반환
  - [x] 목록 최상단에 추가 (부분 업데이트)

### 2.3 명함 수정 (Update)
- [x] 명함 수정 폼 UI
  - [x] 기존 데이터 자동 입력
  - [x] 명함 이미지 변경 기능
  - [x] 기존 이미지 미리보기
- [x] 명함 업데이트 로직
  - [x] 이미지 변경 시 기존 이미지 삭제 (모든 타임스탬프)
  - [x] 새 이미지 업로드 (타임스탬프 포함)
  - [x] VCF 파일 재생성 및 재업로드
  - [x] business_cards 테이블 업데이트
- [x] 수정 후 처리
  - [x] 수정 성공 메시지
  - [x] 수정된 명함 데이터 반환
  - [x] 목록에서 해당 항목 업데이트 (부분 업데이트)
  - [x] 상세 화면 새로고침

### 2.4 명함 삭제 (Delete)
- [x] Soft delete API (is_active = false)
- [ ] 명함 삭제 UI **[미구현]**
  - [ ] 삭제 버튼 추가
  - [ ] 삭제 확인 다이얼로그
  - [ ] 삭제 후 목록 새로고침

### 2.5 명함 상세 보기 (Read)
- [x] 명함 상세 조회 API
- [x] 명함 상세 UI
  - [x] 명함 이미지 표시 (있는 경우)
    - [x] 네트워크 이미지 로딩
    - [x] 캐시된 이미지 표시
    - [x] 로딩 프로그레스 표시
  - [x] 정보 섹션별 표시
    - [x] 기본 정보 (표시명, 성명)
    - [x] 연락처 정보 (전화번호, 이메일, 웹사이트)
    - [x] 조직 정보 (회사/조직, 직책)
    - [x] 주소
    - [x] 메모
  - [x] 등록일 표시
- [x] AppBar 버튼
  - [x] 뒤로가기
  - [x] 수정 버튼

---

## 📱 3. QR코드 생성 및 공유

### 3.1 VCF 다운로드 QR코드
- [x] VCF Signed URL 생성
  - [x] 5분 만료 시간 (300초)
  - [x] Storage 경로: `vcards/{cardId}.vcf`
  - [x] 다운로드 파일명에 한글 이름 포함
  - [x] URL 인코딩 처리
- [x] VCF QR코드 다이얼로그 UI
  - [x] 제목: "VCF 다운로드 QR코드"
  - [x] 설명: "QR코드를 스캔하여 연락처 정보를 다운로드하세요"
  - [x] QR코드 생성 (qr_flutter, 200x200)
  - [x] 닫기 버튼
- [x] 상세 화면에 VCF QR코드 버튼
  - [x] 초록색 박스 디자인
  - [x] 아이콘 및 설명

### 3.2 이미지 다운로드 QR코드
- [x] 이미지 Signed URL 생성
  - [x] 5분 만료 시간 (300초)
  - [x] Public URL에서 파일 경로 추출
  - [x] 다운로드 파일명에 한글 이름 포함
  - [x] URL 인코딩 처리
- [x] 이미지 QR코드 다이얼로그 UI
  - [x] 제목: "이미지 다운로드 QR코드"
  - [x] 설명: "QR코드를 스캔하여 명함 이미지를 다운로드하세요"
  - [x] QR코드 생성 (200x200)
  - [x] 닫기 버튼
- [x] 상세 화면에 이미지 QR코드 버튼
  - [x] 파란색 박스 디자인
  - [x] 아이콘 및 설명
  - [x] 명함 이미지 있는 경우만 표시

### 3.3 외부 사용자 다운로드 (QR 스캔 후)
- [x] VCF 파일 다운로드
  - [x] MIME type: text/vcard
  - [x] 연락처 앱 자동 연동
  - [x] 파일명: `{성명}_명함.vcf`
- [x] 이미지 다운로드
  - [x] MIME type: image/jpeg, image/png 등
  - [x] 갤러리 자동 저장
  - [x] 파일명: `{성명}_명함.{확장자}`

---

## 📄 4. VCF (vCard) 생성

### 4.1 VCardGenerator 유틸 클래스
- [x] vCard 3.0 표준 준수
- [x] VCF 필드 매핑
  - [x] BEGIN:VCARD / END:VCARD
  - [x] VERSION:3.0
  - [x] FN (Full Name - 성명)
  - [x] ORG (Organization - 조직)
  - [x] TITLE (직책)
  - [x] TEL;TYPE=CELL (전화번호)
  - [x] EMAIL;TYPE=INTERNET (이메일)
  - [x] URL (웹사이트)
  - [x] ADR;TYPE=WORK (주소)
  - [x] NOTE (메모)
  - [x] REV (생성일, ISO8601 형식)
- [x] VCF 문자열 생성 메서드
- [x] Uint8List 변환 (UTF-8 인코딩)
- [x] Storage 업로드 (text/vcard MIME type)

---

## 🖼️ 5. 이미지 관리

### 5.1 이미지 업로드
- [x] 이미지 소스 선택 모달
  - [x] 카메라 촬영
  - [x] 갤러리 선택
- [x] 이미지 파일 처리
  - [x] 파일 확장자 감지 (jpg, png, gif, webp)
  - [x] MIME type 자동 설정
  - [x] 타임스탬프 추가 (캐시 무효화)
  - [x] Bytes 변환 및 업로드
- [x] Storage 경로 규칙
  - [x] 명함 이미지: `bcimages/cards/{cardId}_card_{timestamp}.{ext}`
  - [x] VCF 파일: `vcards/{cardId}.vcf`
- [x] Public URL 생성
- [x] 업로드 에러 처리

### 5.2 이미지 캐싱
- [x] ImageCacheService 구현
  - [x] 로컬 디렉토리 경로 획득 (path_provider)
  - [x] URL 기반 캐시 파일명 생성 (MD5 해시)
  - [x] 캐시 존재 여부 확인
  - [x] 캐시 파일 로드
  - [x] 네트워크 이미지 다운로드 및 캐시 저장
- [x] 상세 화면에서 캐시된 이미지 우선 표시
- [x] 네트워크 이미지 로딩 진행 표시

### 5.3 이미지 삭제 및 교체
- [x] 기존 이미지 삭제 로직
  - [x] Storage에서 폴더 파일 목록 조회
  - [x] cardId와 매칭되는 모든 파일 삭제
  - [x] 타임스탬프 포함 파일 처리
- [x] 이미지 수정 시 기존 이미지 자동 삭제
- [ ] 이미지 선택 취소 기능 **[미구현]**

---

## 🗄️ 6. Supabase 데이터베이스

### 6.1 테이블 스키마
- [x] business_cards 테이블
  - [x] 컬럼 정의 (id, user_id, full_name, display_name, phone, email, website, organization, title, address, note, vcf_download_url, business_card_image_url, is_active, view_count, created_at, updated_at)
  - [x] 기본값 설정
  - [x] 제약 조건 (NOT NULL, DEFAULT)
- [x] updated_at 자동 업데이트 트리거
- [x] increment_view_count 함수 (RPC)
- [x] RLS (Row Level Security) 활성화
- [x] RLS 정책: "Allow all operations on business_cards"

### 6.2 Storage 설정
- [x] business-card 버킷 생성
- [x] 버킷 존재 여부 확인 로직
- [ ] 버킷 정책 검토 **[확인 필요]**
  - [x] Public 읽기 (Signed URL)
  - [ ] 사용자별 업로드 권한
  - [ ] 사용자별 삭제 권한

### 6.3 Migration 파일
- [x] create_business_cards_table.sql
- [x] setup_storage.sql
- [x] add_url_columns.sql
- [x] add_business_card_image_url.sql
- [x] make_bucket_private.sql
- [x] create_download_tokens_table.sql (사용 안함)

---

## 🎨 7. UI/UX

### 7.1 로그인 화면 (HomeScreen)
- [x] 그라데이션 배경
- [x] 앱 아이콘 (QR 코드 아이콘, 120px)
- [x] 앱 제목 (28pt, Bold)
- [x] 앱 설명 (16pt)
- [x] 카카오 로그인 버튼 (노란색)
- [x] 로그인 체크 중 로딩 인디케이터

### 7.2 명함 목록 화면 (BusinessCardListScreen)
- [x] AppBar
  - [x] 제목: "내 명함"
  - [x] 로그아웃 버튼
  - [x] 새로고침 버튼
- [x] 명함 추가 버튼 (22.4pt, 40% 크기 증가)
- [x] 명함 카드 리스트
  - [x] 표시명 또는 성명 (22.4pt, 중앙 정렬)
  - [x] 카드 탭 시 상세 화면 이동
- [x] 빈 목록 안내 메시지
- [x] Pull-to-refresh
- [x] 로딩 인디케이터

### 7.3 명함 등록/수정 화면 (BusinessCardFormScreen)
- [x] AppBar
  - [x] 제목: "명함 등록" / "명함 수정"
  - [x] 저장 버튼 (우측)
  - [x] 저장 중 로딩 인디케이터
- [x] 스크롤 가능한 폼
- [x] 섹션별 구분 (제목, 18pt Bold)
- [x] 입력 필드 스타일 통일
- [x] 필수 필드 표시 (*)
- [x] 헬퍼 텍스트 (표시명)

### 7.4 명함 상세 화면 (BusinessCardViewScreen)
- [x] AppBar
  - [x] 제목: 표시명 또는 성명
  - [x] 뒤로가기 버튼
  - [x] 수정 버튼
- [x] 스크롤 가능한 콘텐츠
- [x] 명함 이미지 (280px, contain)
- [x] 정보 섹션 (22pt Bold 제목)
- [x] 정보 항목 (레이블 16pt, 값 19pt)
- [x] VCF QR코드 박스 (초록색)
- [x] 이미지 QR코드 박스 (파란색)
- [x] 등록일 박스 (회색)
- [x] 하단 여백 (80px, 네비게이션 바 대응)

### 7.5 QR코드 다이얼로그
- [x] Dialog (둥근 모서리)
- [x] 제목 (22pt, Bold)
- [x] 설명 (17pt, SemiBold, 회색)
- [x] QR코드 (200x200, 흰색 배경, 테두리)
- [x] 닫기 버튼 (200px 너비)

### 7.6 디자인 통일
- [x] Material Design 3
- [x] 컬러 스킴 (Primary: Blue #2196F3)
- [x] 폰트 크기 일관성
  - [x] 제목: 22-28pt
  - [x] 본문: 16-19pt
  - [x] 버튼: 16-22.4pt
- [x] 버튼 스타일 통일
- [x] 카드 디자인 통일

---

## 🔒 8. 보안

### 8.1 인증 및 권한
- [x] 카카오 토큰 관리
- [x] 자동 로그인 토큰 검증
- [x] 사용자별 데이터 격리 (user_id 필터링)
- [x] 로그인하지 않은 사용자는 빈 목록 반환
- [ ] Supabase RLS 정책 강화 **[확인 필요]**

### 8.2 파일 보안
- [x] Signed URL 사용 (5분 만료)
- [x] 타임스탬프 기반 캐시 무효화
- [x] 파일 삭제 시 Storage에서도 삭제
- [ ] Private bucket 설정 검토 **[확인 필요]**

---



## 🚀 9. 성능 최적화

### 9.1 로딩 최적화
- [x] 이미지 캐싱 (ImageCacheService)
- [x] 이미지 로딩 프로그레스 표시
- [x] 부분 업데이트 (전체 새로고침 방지)
  - [x] 명함 등록 시: 새 명함만 조회 후 목록 최상단 추가
  - [x] 명함 수정 시: 수정된 데이터 반환 후 목록 업데이트
- [x] Storage 버킷 존재 확인 최소화

### 9.2 API 호출 최적화
- [x] 새로고침 제한
  - [x] 1분 쿨다운
  - [x] 1시간에 10번 제한
  - [x] 제한 초과 시 SnackBar 표시
- [x] 불필요한 데이터 조회 방지
- [x] 디버그 로그 (콘솔 출력)

---

## 🐛 10. 알려진 이슈 및 개선 사항

### 10.1 현재 이슈
- [ ] 명함 삭제 UI 미구현 → **기능 추가 필요**
- [ ] 이미지 선택 취소 기능 없음 → **UI 개선 필요**
- [ ] 프로필 이미지 관련 코드 정리 필요 (현재 사용 안함)
- [ ] 상세 화면 수정 후 자동 갱신 로직 개선 필요

### 10.2 개선 사항
- [ ] 에러 핸들링 강화
  - [ ] 네트워크 오류 처리
  - [ ] Storage 용량 초과 처리
  - [ ] 이미지 형식 검증
  - [ ] 사용자 친화적인 에러 메시지
- [ ] 로딩 상태 개선
  - [ ] 전체 화면 로딩 오버레이
  - [ ] 버튼 비활성화 (저장/수정 중)
- [ ] 사용자 피드백 개선
  - [ ] 성공/실패 메시지 통일
  - [ ] 토스트 메시지 디자인 개선

---

## 🧪 11. 테스트 (미구현)

### 11.1 단위 테스트
- [ ] VCardGenerator 테스트
  - [ ] vCard 필드 매핑 검증
  - [ ] 특수 문자 처리 테스트
- [ ] BusinessCardService 테스트
  - [ ] CRUD 메서드 테스트
  - [ ] Signed URL 생성 테스트
- [ ] ImageCacheService 테스트
  - [ ] 캐시 저장/로드 테스트
  - [ ] 해시 생성 테스트

### 11.2 통합 테스트
- [ ] 카카오 로그인 플로우
- [ ] 명함 CRUD 플로우
- [ ] QR코드 생성 및 다운로드 플로우
- [ ] 이미지 업로드 및 캐싱 플로우

### 11.3 UI 테스트
- [ ] 화면 네비게이션 테스트
- [ ] 폼 입력 유효성 검증 테스트
- [ ] 이미지 선택 및 업로드 테스트
- [ ] QR코드 다이얼로그 테스트

---

## 📦 12. 배포 준비

### 12.1 Android
- [x] Gradle 8.3.0 설정
- [x] Kotlin 1.9.0 설정
- [x] minSdkVersion 21 설정
- [ ] targetSdkVersion 확인 **[확인 필요]**
- [ ] 앱 아이콘 설정 **[확인 필요]**
- [ ] 앱 서명 설정 (Keystore)
- [ ] ProGuard 설정 (난독화)
- [ ] 릴리즈 빌드 테스트
- [ ] Google Play Console 등록

### 12.2 iOS
- [x] iOS 12.0 이상 설정
- [ ] 앱 아이콘 설정 **[확인 필요]**
- [ ] Info.plist 권한 설정 확인
  - [ ] 카메라 권한 (NSCameraUsageDescription)
  - [ ] 갤러리 권한 (NSPhotoLibraryUsageDescription)
- [ ] 프로비저닝 프로파일 설정
- [ ] 릴리즈 빌드 테스트
- [ ] App Store Connect 등록

### 12.3 환경 변수
- [x] .env 파일 생성
- [ ] .env.example 파일 생성 (선택)
- [ ] 배포용 환경 변수 별도 관리
- [ ] Git에서 .env 제외 (.gitignore)

---

## 🔮 13. 향후 개발 계획 (Future Roadmap)

### Phase 2 - 공유 기능 강화
- [ ] 카카오톡 공유 기능
  - [ ] VCF 파일 카카오톡 공유
  - [ ] 명함 이미지 카카오톡 공유
  - [ ] 커스텀 메시지 템플릿
- [ ] 명함 이미지 편집 기능
  - [ ] 크롭 (image_cropper)
  - [ ] 회전
  - [ ] 필터 적용
- [ ] 명함 템플릿 제공
  - [ ] 기본 템플릿 3종
  - [ ] 템플릿 커스터마이징
  - [ ] 명함 디자인 프리뷰

### Phase 3 - 프리미엄 기능
- [ ] 결제 기능 구현
  - [ ] 무료 플랜: 최대 3개 명함
  - [ ] 프리미엄 플랜: 무제한 명함
  - [ ] 결제 SDK 연동 (Iamport, Bootpay)
  - [ ] 월 구독 ($2.99/month)
  - [ ] 일회성 구매 ($9.99)
  - [ ] 구매 내역 관리
- [ ] 통계 기능
  - [ ] 명함별 조회수 추적
  - [ ] VCF 다운로드 수 집계
  - [ ] 이미지 다운로드 수 집계
  - [ ] 날짜별 통계 그래프
  - [ ] 인기 명함 순위
- [ ] 명함 공유 이력 관리
  - [ ] 공유 날짜 및 시간 기록
  - [ ] 공유 방법 (QR, 카카오톡) 구분
  - [ ] 공유 이력 목록 화면

### Phase 4 - 글로벌 확장
- [ ] 다국어 지원
  - [ ] i18n 패키지 설정
  - [ ] 영어 (en)
  - [ ] 일본어 (ja)
  - [ ] 중국어 간체 (zh-CN)
  - [ ] 중국어 번체 (zh-TW)
  - [ ] 언어 선택 UI
- [ ] 다크 모드 지원
  - [ ] 다크 테마 정의
  - [ ] 시스템 설정 연동
  - [ ] 테마 토글 버튼
- [ ] NFC 명함 공유 기능
  - [ ] NFC 태그 작성
  - [ ] NFC 태그 읽기
  - [ ] vCard 데이터 NFC 전송
- [ ] 웹 버전 개발
  - [ ] Flutter Web 빌드
  - [ ] 반응형 디자인
  - [ ] 웹 호스팅 (Firebase Hosting, Vercel)

---

## 📚 14. 문서화

### 14.1 개발 문서
- [x] PRD (Product Requirements Document)
- [x] 개발 체크리스트 (현재 문서)
- [ ] API 문서 (Supabase RPC)
- [ ] 데이터베이스 ERD (draw.io)
- [ ] 시스템 설계서
- [ ] 코드 주석 및 문서화

### 14.2 사용자 문서
- [ ] 사용자 가이드 (앱 사용법)
- [ ] FAQ (자주 묻는 질문)
- [ ] 개인정보 처리방침
- [ ] 서비스 이용약관

---

## 🎯 현재 우선순위

### 🔴 긴급 (High Priority)
1. [ ] 명함 삭제 기능 UI 구현
2. [ ] 이미지 선택 취소 기능 추가
3. [ ] 에러 핸들링 강화

### 🟡 중요 (Medium Priority)
4. [ ] Supabase RLS 정책 검토 및 강화
5. [ ] 프로필 이미지 관련 코드 정리
6. [ ] 테스트 코드 작성 (단위, 통합, UI)

### 🟢 일반 (Low Priority)
7. [ ] 릴리즈 빌드 준비 (Android, iOS)
8. [ ] 문서화 (ERD, 시스템 설계서, API 문서)
9. [ ] 성능 모니터링 도구 연동

---

## ✅ 체크리스트 범례
- [x] 완료
- [ ] 미완료
- **[미구현]** 기능 추가 필요
- **[확인 필요]** 검토 및 확인 필요
- **[개선 필요]** 기존 기능 개선 필요

---

> 💡 **팁**: Git 커밋 시 체크리스트 항목과 연결하여 커밋 메시지 작성  
> 예: `[CHECKLIST] 2.4 명함 삭제 UI 구현 완료`

