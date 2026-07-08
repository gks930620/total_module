package com.doll.gacha.jwt.controller;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.jwt.model.MyInfoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/my")
@RequiredArgsConstructor
public class UserController {

    /**
     * 내 정보 조회. 라우트가 authenticated() 이므로 customUserAccount 는 항상 존재한다.
     */
    @GetMapping("/info")
    public ResponseEntity<ApiResponse<MyInfoResponse>> getMyInfo(@AuthenticationPrincipal CustomUserAccount customUserAccount) {
        MyInfoResponse myInfo = MyInfoResponse.from(customUserAccount.getUserDTO());
        return ResponseEntity.ok(ApiResponse.success("내 정보 조회 성공", myInfo));
    }
}
