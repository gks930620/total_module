package com.businesscard.card.entity;

import com.businesscard.card.dto.BusinessCardUpsertRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "business_cards")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BusinessCardEntity {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false, length = 120)
    private String userId;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "display_name", length = 120)
    private String displayName;

    @Column(name = "structured_name", length = 200)
    private String structuredName;

    @Column(length = 50)
    private String phone;

    @Column(length = 120)
    private String email;

    @Column(length = 200)
    private String website;

    @Column(length = 120)
    private String organization;

    @Column(length = 120)
    private String title;

    @Column(length = 300)
    private String address;

    @Column(length = 500)
    private String note;

    @Column(name = "business_card_image_path", length = 500)
    private String businessCardImagePath;

    @Column(name = "is_active", nullable = false)
    private boolean isActive;

    @Column(name = "view_count", nullable = false)
    private int viewCount;

    @Column(name = "vcf_download_token", length = 120)
    private String vcfDownloadToken;

    @Column(name = "vcf_token_expires_at")
    private LocalDateTime vcfTokenExpiresAt;

    @Column(name = "image_download_token", length = 120)
    private String imageDownloadToken;

    @Column(name = "image_token_expires_at")
    private LocalDateTime imageTokenExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public BusinessCardEntity(
            String id,
            String userId,
            String fullName,
            String displayName,
            String structuredName,
            String phone,
            String email,
            String website,
            String organization,
            String title,
            String address,
            String note,
            String businessCardImagePath
    ) {
        this.id = id;
        this.userId = userId;
        this.fullName = fullName;
        this.displayName = displayName;
        this.structuredName = structuredName;
        this.phone = phone;
        this.email = email;
        this.website = website;
        this.organization = organization;
        this.title = title;
        this.address = address;
        this.note = note;
        this.businessCardImagePath = businessCardImagePath;
        this.isActive = true;
        this.viewCount = 0;
    }

    public void updateFrom(BusinessCardUpsertRequest request, String imagePath) {
        this.fullName = request.getFullName();
        this.displayName = request.getDisplayName();
        this.structuredName = request.getStructuredName();
        this.phone = request.getPhone();
        this.email = request.getEmail();
        this.website = request.getWebsite();
        this.organization = request.getOrganization();
        this.title = request.getTitle();
        this.address = request.getAddress();
        this.note = request.getNote();
        this.businessCardImagePath = imagePath;
    }

    public void deactivate() {
        this.isActive = false;
    }

    public void incrementViewCount() {
        this.viewCount += 1;
    }

    public void issueVcfToken(String token, LocalDateTime expiresAt) {
        this.vcfDownloadToken = token;
        this.vcfTokenExpiresAt = expiresAt;
    }

    public void issueImageToken(String token, LocalDateTime expiresAt) {
        this.imageDownloadToken = token;
        this.imageTokenExpiresAt = expiresAt;
    }

    public boolean isVcfTokenValid(String token) {
        return token != null
                && token.equals(vcfDownloadToken)
                && vcfTokenExpiresAt != null
                && LocalDateTime.now().isBefore(vcfTokenExpiresAt);
    }

    public boolean isImageTokenValid(String token) {
        return token != null
                && token.equals(imageDownloadToken)
                && imageTokenExpiresAt != null
                && LocalDateTime.now().isBefore(imageTokenExpiresAt);
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (!isActive) {
            isActive = true;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
