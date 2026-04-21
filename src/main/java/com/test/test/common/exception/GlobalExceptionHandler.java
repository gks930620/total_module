package com.test.test.common.exception;

import com.test.test.common.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 전역 예외 처리 핸들러
 * Controller에서 발생하는 모든 예외를 처리
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 비즈니스 예외 처리 (커스텀 예외들의 부모)
     * - EntityNotFoundException → 404
     * - AccessDeniedException → 403
     * - BusinessRuleException → 400
     * - DuplicateResourceException → 409
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException e) {
        log.warn("Business Exception: {} - {}", e.getErrorCode(), e.getMessage());

        ErrorResponse response = ErrorResponse.of(e.getMessage(), e.getErrorCode());
        return ResponseEntity.status(e.getStatus()).body(response);
    }

    /**
     * 유효성 검증 실패 (@Valid 검증 실패)
     * DTO의 @NotBlank, @Size 등 검증 실패 시 발생
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException e) {
        log.warn("Validation Exception: {}", e.getMessage());

        List<ErrorResponse.FieldError> fieldErrors = e.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> ErrorResponse.FieldError.builder()
                        .field(error.getField())
                        .message(error.getDefaultMessage())
                        .rejectedValue(error.getRejectedValue())
                        .build())
                .collect(Collectors.toList());

        ErrorResponse response = ErrorResponse.of(
                "입력값이 올바르지 않습니다.",
                "VALIDATION_ERROR",
                fieldErrors
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * JSON 파싱 실패 (잘못된 JSON 형식)
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadable(HttpMessageNotReadableException e) {
        log.warn("JSON Parse Exception: {}", e.getMessage());

        ErrorResponse response = ErrorResponse.of(
                "요청 본문을 읽을 수 없습니다. JSON 형식을 확인해주세요.",
                "INVALID_JSON"
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * 필수 요청 파라미터 누락
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException e) {
        log.warn("Missing Parameter: {}", e.getParameterName());

        ErrorResponse response = ErrorResponse.of(
                "필수 파라미터가 누락되었습니다: " + e.getParameterName(),
                "MISSING_PARAMETER"
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * 파라미터 타입 불일치 (예: Long에 문자열 전달)
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        log.warn("Type Mismatch: {} - {}", e.getName(), e.getValue());

        ErrorResponse response = ErrorResponse.of(
                "파라미터 타입이 올바르지 않습니다: " + e.getName(),
                "TYPE_MISMATCH"
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * IllegalArgumentException 처리 (마이그레이션 중 기존 코드 호환)
     * 추후 커스텀 예외로 모두 변환되면 제거 가능
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("IllegalArgumentException: {}", e.getMessage());

        // 메시지 내용에 따라 적절한 상태 코드 반환
        HttpStatus status = determineStatusFromMessage(e.getMessage());
        String errorCode = determineErrorCodeFromMessage(e.getMessage());

        ErrorResponse response = ErrorResponse.of(e.getMessage(), errorCode);
        return ResponseEntity.status(status).body(response);
    }

    /**
     * IllegalStateException 처리 (이미 삭제된 리소스 등)
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException e) {
        log.warn("IllegalStateException: {}", e.getMessage());

        ErrorResponse response = ErrorResponse.of(e.getMessage(), "INVALID_STATE");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    /**
     * 예상치 못한 예외 처리 (최후의 보루)
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unexpected Exception: ", e);

        ErrorResponse response = ErrorResponse.of(
                "서버 내부 오류가 발생했습니다.",
                "INTERNAL_SERVER_ERROR"
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    /**
     * 메시지 내용으로 HTTP 상태 코드 결정 (마이그레이션 용)
     */
    private HttpStatus determineStatusFromMessage(String message) {
        if (message == null) return HttpStatus.BAD_REQUEST;

        if (message.contains("찾을 수 없습니다")) {
            return HttpStatus.NOT_FOUND;
        }
        if (message.contains("본인의") || message.contains("권한이 없습니다")) {
            return HttpStatus.FORBIDDEN;
        }
        return HttpStatus.BAD_REQUEST;
    }

    /**
     * 메시지 내용으로 에러 코드 결정 (마이그레이션 용)
     */
    private String determineErrorCodeFromMessage(String message) {
        if (message == null) return "BAD_REQUEST";

        if (message.contains("찾을 수 없습니다")) {
            return "NOT_FOUND";
        }
        if (message.contains("본인의") || message.contains("권한이 없습니다")) {
            return "ACCESS_DENIED";
        }
        return "BAD_REQUEST";
    }
}

