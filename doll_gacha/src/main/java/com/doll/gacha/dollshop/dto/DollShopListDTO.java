package com.doll.gacha.dollshop.dto;

import com.doll.gacha.dollshop.DollShop;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DollShopListDTO {

    private Long id;
    private String businessName;
    private Double longitude;
    private Double latitude;
    private String address;
    private Integer totalGameMachines;
    private String phone;
    private Boolean isOperating;
    private LocalDate approvalDate;
    private String gubun1;
    private String gubun2;
    private String imagePath;
    private Double averageRating;
    private Long reviewCount;
    private Double averageMachineStrength;
    private Double averageLargeCost;
    private Double averageMediumCost;
    private Double averageSmallCost;


    public static DollShopListDTO from(DollShop entity) {
        if (entity == null) {
            return null;
        }
        return DollShopListDTO.builder()
            .id(entity.getId())
            .businessName(entity.getBusinessName())
            .longitude(entity.getLongitude())
            .latitude(entity.getLatitude())
            .address(entity.getAddress())
            .totalGameMachines(entity.getTotalGameMachines())
            .phone(entity.getPhone())
            .isOperating(entity.getIsOperating())
            .approvalDate(entity.getApprovalDate())
            .gubun1(entity.getGubun1())
            .gubun2(entity.getGubun2())
            .imagePath(entity.getImagePath())
            .averageRating(0.0)  // 기본값, 실제 값은 QueryDSL에서 설정
            .reviewCount(0L)     // 기본값, 실제 값은 QueryDSL에서 설정
            .averageMachineStrength(0.0)
            .averageLargeCost(0.0)
            .averageMediumCost(0.0)
            .averageSmallCost(0.0)
            .build();
    }

    public DollShop toEntity() {
        return DollShop.builder()
            .id(this.id)
            .businessName(this.businessName)
            .longitude(this.longitude)
            .latitude(this.latitude)
            .address(this.address)
            .totalGameMachines(this.totalGameMachines)
            .phone(this.phone)
            .isOperating(this.isOperating)
            .approvalDate(this.approvalDate)
            .gubun1(this.gubun1)
            .gubun2(this.gubun2)
            .imagePath(this.imagePath)
            .build();
    }
}
