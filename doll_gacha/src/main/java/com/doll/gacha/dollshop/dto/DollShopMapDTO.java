package com.doll.gacha.dollshop.dto;

import com.doll.gacha.dollshop.DollShop;
import java.time.LocalDate;
import lombok.*;

/**
 * 지도용 응답 DTO - 마커 표시에 필요한 최소 데이터만 포함
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DollShopMapDTO {
    private Long id;                    // 매장 ID
    private String businessName;        // 매장명
    private String address;             // 주소
    private String phone;               // 전화번호
    private Double longitude;           // 경도 (x)
    private Double latitude;            // 위도 (y)
    private Integer totalGameMachines;  // 총 기계 수
    private LocalDate approvalDate;        // 승인일
    private Boolean isOperating;        // 운영 여부

    /**
     * DollShop 엔티티를 MapDTO로 변환
     */
    public static DollShopMapDTO from(DollShop shop) {
        return DollShopMapDTO.builder()
                .id(shop.getId())
                .businessName(shop.getBusinessName())
                .address(shop.getAddress())
                .phone(shop.getPhone())
                .longitude(shop.getLongitude())
                .latitude(shop.getLatitude())
                .totalGameMachines(shop.getTotalGameMachines())
                .approvalDate(shop.getApprovalDate())
                .isOperating(shop.getIsOperating())
                .build();
    }
}

