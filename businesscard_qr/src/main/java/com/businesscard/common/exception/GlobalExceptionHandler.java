package com.businesscard.common.exception;

import com.businesscard.common.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 전역 예외 처리 핸들러
 * Controller에서 발생하는 모든 예외를 처리
 *
 * <p>{@link ResponseEntityExceptionHandler}를 상속해 프레임워크 표준 예외
 * (404 NoResourceFound, 405 MethodNotSupported, 415 MediaTypeNotSupported,
 * 400 MissingServletRequestPart 등)가 최후의 보루(500)로 떨어지지 않고
 * 원래 상태 코드 그대로 프로젝트 공통 에러 응답으로 내려가게 한다.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    /**
     * 프레임워크 예외 공통 처리 지점.
     * 상태 코드는 프레임워크가 정한 값을 유지하고, 본문만 ErrorResponse 형태로 감싼다.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex,
            Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request
    ) {
        if (statusCode.is5xxServerError()) {
            log.error("Framework Exception: {}", ex.getMessage(), ex);
        } else {
            log.warn("Framework Exception: {} - {}", ex.getClass().getSimpleName(), ex.getMessage());
        }

        Object responseBody = body instanceof ErrorResponse
                ? body
                : ErrorResponse.of(messageFor(statusCode), errorCodeFor(statusCode));
        return super.handleExceptionInternal(ex, responseBody, headers, statusCode, request);
    }

    /**
     * 유효성 검증 실패 (@Valid 검증 실패)
     * DTO의 @NotBlank, @Size 등 검증 실패 시 발생
     */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request
    ) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getBindingResult()
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
        return handleExceptionInternal(ex, response, headers, status, request);
    }

    /**
     * JSON 파싱 실패 (잘못된 JSON 형식)
     */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request
    ) {
        ErrorResponse response = ErrorResponse.of(
                "요청 본문을 읽을 수 없습니다. JSON 형식을 확인해주세요.",
                "INVALID_JSON"
        );
        return handleExceptionInternal(ex, response, headers, status, request);
    }

    /**
     * 필수 요청 파라미터 누락
     */
    @Override
    protected ResponseEntity<Object> handleMissingServletRequestParameter(
            MissingServletRequestParameterException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request
    ) {
        ErrorResponse response = ErrorResponse.of(
                "필수 파라미터가 누락되었습니다: " + ex.getParameterName(),
                "MISSING_PARAMETER"
        );
        return handleExceptionInternal(ex, response, headers, status, request);
    }

    /**
     * 업로드 파일 용량 초과 (multipart max-file-size / max-request-size 초과) → 413
     */
    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request
    ) {
        ErrorResponse response = ErrorResponse.of(
                "업로드 가능한 파일 크기를 초과했습니다.",
                "PAYLOAD_TOO_LARGE"
        );
        return handleExceptionInternal(ex, response, headers, HttpStatus.PAYLOAD_TOO_LARGE, request);
    }

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
     * 데이터 무결성 위반 (예: 클라이언트가 지정한 명함 id가 이미 존재해 PK 충돌)
     * 일반 Exception 핸들러(500)로 떨어지지 않도록 409로 매핑한다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        log.warn("DataIntegrityViolationException: {}", e.getMessage());

        ErrorResponse response = ErrorResponse.of(
                "이미 존재하는 리소스이거나 데이터 제약 조건을 위반했습니다.",
                "DATA_INTEGRITY_VIOLATION"
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    /**
     * 예상치 못한 예외 처리 (최후의 보루)
     * 프레임워크 표준 예외는 ResponseEntityExceptionHandler가 먼저 처리하므로 여기 도달하지 않는다.
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
     * 프레임워크 예외의 상태 코드에 맞는 사용자용 메시지
     */
    private String messageFor(HttpStatusCode statusCode) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        if (status == null) {
            return "요청을 처리할 수 없습니다.";
        }
        return switch (status) {
            case BAD_REQUEST -> "요청이 올바르지 않습니다.";
            case NOT_FOUND -> "요청한 리소스를 찾을 수 없습니다.";
            case METHOD_NOT_ALLOWED -> "지원하지 않는 HTTP 메서드입니다.";
            case NOT_ACCEPTABLE -> "응답할 수 없는 형식을 요청했습니다.";
            case PAYLOAD_TOO_LARGE -> "업로드 가능한 파일 크기를 초과했습니다.";
            case UNSUPPORTED_MEDIA_TYPE -> "지원하지 않는 요청 형식입니다.";
            case INTERNAL_SERVER_ERROR -> "서버 내부 오류가 발생했습니다.";
            case SERVICE_UNAVAILABLE -> "일시적으로 요청을 처리할 수 없습니다.";
            default -> "요청을 처리할 수 없습니다.";
        };
    }

    /**
     * 프레임워크 예외의 상태 코드에 맞는 에러 코드
     */
    private String errorCodeFor(HttpStatusCode statusCode) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        return status != null ? status.name() : "ERROR";
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
