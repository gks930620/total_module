package com.businesscard.common.web;

/**
 * 검색엔진 색인 차단 — 명함 화면과 명함 사진에 붙인다.
 *
 * <p>명함 링크는 "링크를 받은 사람만 본다"가 전제다(UUID = 열람 권한). 그런데 누가 링크를
 * 공개 게시판에 올리면 검색엔진이 그 명함(연락처·사진)을 검색 결과에 올릴 수 있다.
 * 이 헤더가 있으면 검색엔진은 페이지를 읽어도 색인하지 않는다.
 *
 * <p>robots.txt 로 막지 않는 이유: 막으면 검색엔진이 페이지를 아예 안 읽어서 이 헤더도 못 본다 —
 * 그러면 링크만 있는 "제목 없는 검색 결과"로 색인될 수 있다.
 */
public final class Robots {

    public static final String HEADER = "X-Robots-Tag";
    public static final String NOINDEX = "noindex, nofollow";

    private Robots() {
    }
}
