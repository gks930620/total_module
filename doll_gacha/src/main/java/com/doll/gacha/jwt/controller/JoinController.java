package com.doll.gacha.jwt.controller;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.jwt.model.JoinDTO;
import com.doll.gacha.jwt.service.JoinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/join")
@RequiredArgsConstructor
public class JoinController {

    private final JoinService joinService;

    @PostMapping
    public ResponseEntity<ApiResponse<Void>> join(@Valid @RequestBody JoinDTO joinDTO) {
        joinService.joinProcess(joinDTO);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("회원가입이 완료되었습니다"));
    }
}
