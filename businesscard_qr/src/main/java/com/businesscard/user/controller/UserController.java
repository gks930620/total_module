package com.businesscard.user.controller;

import com.businesscard.common.dto.ApiResponse;
import com.businesscard.user.dto.UserResponse;
import com.businesscard.user.dto.UserSyncRequest;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<UserResponse>> syncUser(@Valid @RequestBody UserSyncRequest request) {
        UserEntity user = userService.syncUser(request);
        return ResponseEntity.ok(ApiResponse.success("사용자 동기화 성공", UserResponse.from(user)));
    }
}
