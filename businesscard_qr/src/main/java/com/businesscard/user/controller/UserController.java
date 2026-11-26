package com.businesscard.user.controller;

import com.businesscard.auth.support.AuthCookies;
import com.businesscard.common.dto.ApiResponse;
import com.businesscard.user.dto.UserResponse;
import com.businesscard.user.dto.UserSyncRequest;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.service.AccountDeletionService;
import com.businesscard.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AccountDeletionService accountDeletionService;
    private final AuthCookies authCookies;

    /**
     * 회원 탈퇴. 계정·명함·이미지를 즉시 파기한다(결제 기록은 법정 보관 기간 동안 남는다).
     *
     * <p>삭제 대상과 보관 항목은 {@code static/privacy.html} §3 과 일치해야 한다.
     *
     * <p>웹 세션 쿠키도 함께 지운다. 토큰은 사용자가 사라지는 순간 어차피 무효지만,
     * 쿠키가 남아 있으면 브라우저가 계속 실어 보내고 화면은 "로그인 상태"로 착각한다.
     */
    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<Void>> deleteAccount(Authentication authentication) {
        accountDeletionService.deleteAccount(authentication.getName());
        return authCookies.clear(ResponseEntity.ok(), ApiResponse.success("Account deleted", null));
    }

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<UserResponse>> syncUser(
            Authentication authentication,
            @Valid @RequestBody UserSyncRequest request
    ) {
        userService.validateSyncRequest(authentication.getName(), request);
        UserEntity user = userService.syncUser(request);
        return ResponseEntity.ok(ApiResponse.success("User sync success", UserResponse.from(user)));
    }
}
