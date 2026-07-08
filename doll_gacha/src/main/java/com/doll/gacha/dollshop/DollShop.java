package com.doll.gacha.dollshop;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "doll_shop")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DollShop {

    @Id
    private Long id;

    @Column(nullable = false)
    private String businessName;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(nullable = false)
    private Integer totalGameMachines;

    @Column(length = 50)
    private String phone;

    @Column(nullable = false)
    private Boolean isOperating;

    @Column(nullable = false)
    private LocalDate approvalDate;

    // 추가 필드: 시/도 (예: 서울특별시, 경기도, 전라남도)
    @Column(nullable = false, length = 50)
    private String gubun1;

    // 추가 필드: 시/군/구 (예: 강남구, 수원시, 여수시)
    @Column(nullable = false, length = 50)
    private String gubun2;

    // 가게 대표 이미지 URL
    @Column(length = 300)
    private String imagePath;
}
