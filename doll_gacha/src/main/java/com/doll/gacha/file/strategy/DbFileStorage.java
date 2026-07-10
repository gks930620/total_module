package com.doll.gacha.file.strategy;

import com.doll.gacha.file.entity.StoredFileEntity;
import com.doll.gacha.file.repository.StoredFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * DB(LONGBLOB) 파일 저장 전략 — 로컬(H2)·운영(MySQL) 공통 유일 구현.
 *
 * <p>파일 바이트를 {@code stored_files} 테이블에 저장하므로 Railway 재배포/재시작에도 보존된다.
 * (로컬은 인메모리 H2라 매 기동 초기화 — 로컬 데이터 비영속 원칙과 일치)
 * 외부 스토리지(Supabase 등)를 쓰지 않아 SUPABASE_* 같은 외부 의존성이 없다.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class DbFileStorage implements FileStorageStrategy {

    private final StoredFileRepository storedFileRepository;

    @Override
    @Transactional
    public FileUploadResult uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다");
        }

        String originalFilename = file.getOriginalFilename();
        String storedFilename = generateStoredFilename(originalFilename);

        try {
            storedFileRepository.save(
                    new StoredFileEntity(storedFilename, file.getBytes(), file.getContentType()));
        } catch (IOException e) {
            log.error("파일 저장 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 저장 실패: " + originalFilename, e);
        }

        log.info("DB 파일 저장 완료 - 원본: {}, 저장: {}", originalFilename, storedFilename);

        return FileUploadResult.builder()
                .originalFilename(originalFilename)
                .storedFilename(storedFilename)
                .filePath("/uploads/" + storedFilename)  // 웹 경로 (FileController가 DB에서 서빙)
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .build();
    }

    @Override
    @Transactional
    public void deleteFile(String filePath) {
        String storedFilename = extractStoredFilename(filePath);
        storedFileRepository.deleteById(storedFilename);
        log.info("DB 파일 삭제 완료: {}", storedFilename);
    }

    private String generateStoredFilename(String originalFilename) {
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        return UUID.randomUUID() + extension;
    }

    /** "/uploads/xxx.jpg" 또는 "xxx.jpg" 어느 쪽이 와도 저장 파일명만 추출 */
    private String extractStoredFilename(String filePath) {
        if (filePath == null) {
            return "";
        }
        int lastSlash = filePath.lastIndexOf('/');
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }
}
