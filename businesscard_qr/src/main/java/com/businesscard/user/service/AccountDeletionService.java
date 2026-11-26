package com.businesscard.user.service;

import com.businesscard.card.storage.FileStorage;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 회원 탈퇴(계정 삭제).
 *
 * <p><b>왜 있어야 하나:</b> Google Play 는 계정을 만들 수 있는 앱에 대해
 * 앱 안에서의 계정 삭제 수단을 요구한다. 없으면 심사에서 막힌다.
 *
 * <p>파기 범위는 {@code static/privacy.html} §3 과 같다 —
 * 계정·명함·이미지는 즉시 파기하고, <b>결제 기록은 전자상거래법상 5년 보관</b>이라 남긴다.
 *
 * <p>DB 삭제는 {@link UserService#purgeAccount} 의 짧은 트랜잭션에서 하고,
 * 버킷 파일 삭제(외부 I/O)는 <b>트랜잭션 밖</b>에서 한다 — 코드컨벤션 §1.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final UserService userService;
    private final FileStorage fileStorage;

    public void deleteAccount(String userId) {
        List<String> imagePaths = userService.purgeAccount(userId);

        // DB 를 먼저 지운 뒤 파일을 지운다. 순서를 뒤집으면 DB 삭제가 실패했을 때
        // 행은 남았는데 이미지만 사라져 복구 불가능한 깨진 명함이 된다.
        for (String imagePath : imagePaths) {
            try {
                fileStorage.delete(imagePath);
            } catch (Exception e) {
                // 파일 하나가 안 지워졌다고 탈퇴 자체를 실패시키지 않는다.
                // 계정은 이미 지워졌고, 남은 파일은 참조가 끊긴 orphan 일 뿐이다.
                log.warn("탈퇴 처리 중 이미지 삭제 실패 (orphan 으로 남음): {}", imagePath, e);
            }
        }
        log.info("회원 탈퇴 완료: userId={}, 삭제한 이미지 {}건", userId, imagePaths.size());
    }
}
