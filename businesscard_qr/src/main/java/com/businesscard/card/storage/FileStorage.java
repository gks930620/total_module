package com.businesscard.card.storage;

import java.util.Optional;

/**
 * 업로드 파일 저장 추상화.
 *
 * <p>구현체(DB(MySQL) / 로컬 디스크)와 무관하게 동일한 논리 경로 규칙을 사용한다.
 * 논리 경로는 항상 {@code /uploads/<relativeKey>} 형태이며, DB에는 이 논리 경로가 저장된다.
 * 따라서 저장 백엔드를 바꿔도 저장된 데이터/응답 계약은 변하지 않는다.
 */
public interface FileStorage {

    String LOGICAL_PREFIX = "/uploads/";

    /**
     * 파일을 저장하고 논리 경로를 돌려준다.
     *
     * @param relativeKey 예: {@code business-card-images/abc.png}
     * @param content     파일 바이트
     * @param contentType MIME 타입(널 허용)
     * @return 논리 경로. 예: {@code /uploads/business-card-images/abc.png}
     */
    String store(String relativeKey, byte[] content, String contentType);

    /**
     * 논리 경로로 파일을 읽는다. 없으면 {@link Optional#empty()}.
     *
     * @param logicalPath 예: {@code /uploads/business-card-images/abc.png}
     */
    Optional<StoredFile> load(String logicalPath);

    /**
     * 논리 경로의 파일을 삭제한다. 없으면 조용히 무시한다.
     */
    void delete(String logicalPath);

    /**
     * 논리 경로에서 {@code /uploads/} 접두사를 제거해 상대 키를 얻는다.
     */
    default String toRelativeKey(String logicalPath) {
        if (logicalPath == null) {
            return null;
        }
        return logicalPath.startsWith(LOGICAL_PREFIX)
                ? logicalPath.substring(LOGICAL_PREFIX.length())
                : logicalPath;
    }
}
