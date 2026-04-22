-- Railway MySQL 8.x용: FK 체크 비활성화 후 모든 테이블 데이터 삭제
SET FOREIGN_KEY_CHECKS = 0;

-- 기존 데이터 모두 삭제 (FK 순서 무시)
DELETE FROM refresh_entity;
DELETE FROM comment;
DELETE FROM community;
DELETE FROM files;
DELETE FROM chat_room;
DELETE FROM users;

SET FOREIGN_KEY_CHECKS = 1;

