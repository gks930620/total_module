package com.businesscard.card.storage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StoredFileRepository extends JpaRepository<StoredFileEntity, String> {
}
