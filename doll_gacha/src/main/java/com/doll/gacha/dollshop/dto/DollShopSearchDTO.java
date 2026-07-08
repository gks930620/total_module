package com.doll.gacha.dollshop.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DollShopSearchDTO {
    private String gubun1;          // 시/도
    private String gubun2;          // 시/군/구
    private String keyword;         // 검색 키워드 (매장명, 주소 등)
}

