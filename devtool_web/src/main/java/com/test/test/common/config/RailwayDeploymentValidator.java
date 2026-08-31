package com.test.test.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 운영(Railway) 배포 안전장치 — "조용한 성공"보다 "시끄러운 실패"(설계 §5-2, 개발배포 체크리스트 A2).
 *
 * <p>운영 환경(prod 프로파일 또는 RAILWAY_* 환경변수)에서만 동작하며, 아래를 발견하면
 * 기동을 즉시 실패(fail-fast)시켜 오배포를 막는다.
 * <ol>
 *   <li>app.public-base-url 이 비었거나 localhost → 절대 URL 조립이 깨지므로 죽인다.</li>
 * </ol>
 *
 * <p>이 도구 프로젝트는 <b>로그인·파일 업로드·데이터베이스·외부 API 가 모두 없으므로</b>
 * JWT 시크릿·BUCKET·DB 접속·외부 서비스키 검증은 대상이 아니다.
 * 저장 기능이 생기면 DB(H2/인메모리 오배포) 검증을 여기에 다시 추가할 것.
 */
@Slf4j
@Component
public class RailwayDeploymentValidator implements ApplicationRunner {

    private final Environment env;

    public RailwayDeploymentValidator(Environment env) {
        this.env = env;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!isProductionDeployment()) {
            return; // 로컬/테스트에서는 검증하지 않는다(로컬은 H2/localhost 가 정상).
        }

        List<String> failures = new ArrayList<>();

        // 공개 base URL 검증: 절대 URL 조립 기준. 비었거나 localhost 면 운영에서 깨진다.
        String publicBaseUrl = env.getProperty("app.public-base-url", "");
        if (publicBaseUrl.isBlank()) {
            failures.add("APP_PUBLIC_BASE_URL 이 비어 있습니다. 이 서비스의 공개 도메인(https://...)을 설정하세요.");
        } else if (publicBaseUrl.toLowerCase().contains("localhost")) {
            failures.add("APP_PUBLIC_BASE_URL 이 localhost(" + publicBaseUrl + ")입니다. "
                    + "운영에서는 실제 공개 도메인(https://...)을 설정해야 합니다.");
        }

        if (!failures.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            sb.append("\n==================== 배포 설정 검증 실패(fail-fast) ====================\n");
            for (int i = 0; i < failures.size(); i++) {
                sb.append("  ").append(i + 1).append(". ").append(failures.get(i)).append('\n');
            }
            sb.append("  → 위 환경변수를 Railway 서비스 설정에 넣은 뒤 재배포하세요.\n");
            sb.append("=====================================================================");
            throw new IllegalStateException(sb.toString());
        }

        log.info("배포 설정 검증 통과(prod): publicBaseUrl={}", publicBaseUrl);
    }

    /** prod 프로파일이 활성화됐거나 RAILWAY_* 환경변수가 존재하면 운영 배포로 간주. */
    private boolean isProductionDeployment() {
        for (String profile : env.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return System.getenv().keySet().stream().anyMatch(k -> k.startsWith("RAILWAY_"));
    }
}
