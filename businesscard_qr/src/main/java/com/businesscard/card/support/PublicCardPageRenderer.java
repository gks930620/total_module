package com.businesscard.card.support;

import com.businesscard.card.dto.PublicCardPreview;
import com.businesscard.common.web.PublicUrlResolver;
import com.businesscard.common.web.Robots;
import com.businesscard.common.web.SupportedLanguages;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

/**
 * 공개 명함 화면({@code /c/{id}})의 HTML — 웹앱의 index.html 에 "누구의 명함인지" 미리보기 태그를 끼워 넣는다.
 *
 * <p>카톡·메신저의 미리보기 수집기는 자바스크립트를 실행하지 않는다. React 가 그리는 화면은 못 보고
 * 서버가 내려준 HTML 의 og 태그만 읽는다. 사람이 열면 같은 index.html 이라 웹앱이 그대로 뜬다.
 *
 * <p><b>보안 경계:</b> 끼워 넣는 값은 사용자가 입력한 이름·직함·회사다.
 * <ul>
 *   <li>모든 값을 HTML 이스케이프한다.</li>
 *   <li>정규식 치환({@code replaceFirst})에 사용자 값을 넣지 않는다 — {@code $1}, {@code \} 가 치환 문법으로 해석된다.
 *       그래서 위치를 찾은 뒤 문자열을 잘라 붙인다.</li>
 * </ul>
 */
@Slf4j
@Component
public class PublicCardPageRenderer {

    private static final Pattern TITLE = Pattern.compile("[ \\t]*<title>.*?</title>[ \\t]*\\R?", Pattern.DOTALL);
    private static final Pattern DESCRIPTION = Pattern.compile("[ \\t]*<meta\\s+name=\"description\"[^>]*>[ \\t]*\\R?");
    private static final String HEAD_END = "</head>";
    private static final String SEPARATOR = " · ";

    /**
     * 명함 사진이 없을 때의 대표 이미지 — {@code frontend/public/icons/og-default.jpg}, 1200×630.
     * 그라데이션 배경이라 PNG 는 600KB 가 넘는다. 메신저 수집기가 가볍게 받도록 JPEG 로 둔다.
     */
    private static final String DEFAULT_IMAGE_PATH = "/icons/og-default.jpg";

    /** 직함·회사가 둘 다 비었을 때 이름 아래에 들어갈 문구. */
    private static final Map<String, String> FALLBACK_DESCRIPTIONS = Map.of(
            "ko", "링크를 열어 명함을 보고 연락처에 저장하세요",
            "en", "Open the link to view the card and save the contact.",
            "ja", "リンクを開いて名刺を確認し、連絡先に保存できます",
            "zh", "打开链接查看名片并保存联系人",
            "es", "Abre el enlace para ver la tarjeta y guardar el contacto.",
            "de", "Öffne den Link, um die Karte zu sehen und den Kontakt zu speichern.");

    /**
     * 빌드 산출물(static/index.html)이 없을 때 쓰는 최소 셸. 정상 빌드에서는 쓰이지 않는다.
     * 이때도 미리보기 태그는 들어가서, 링크 미리보기만큼은 계속 동작한다.
     */
    private static final String MINIMAL_SHELL = """
            <!doctype html>
            <html lang="ko">
              <head>
                <meta charset="UTF-8" />
                <title>명함QR</title>
              </head>
              <body>
                <div id="root"></div>
              </body>
            </html>
            """;

    private final String shell;
    private final PublicUrlResolver publicUrlResolver;

    /**
     * index.html 은 시작할 때 한 번만 읽는다 — 배포된 jar 안의 파일이라 실행 중에 바뀌지 않는다.
     * (로컬에서 서버를 띄운 채 프론트를 다시 빌드했다면 서버를 재시작해야 새 번들 이름이 반영된다.)
     */
    public PublicCardPageRenderer(
            @Value("classpath:static/index.html") Resource indexHtml,
            PublicUrlResolver publicUrlResolver
    ) {
        this.shell = read(indexHtml);
        this.publicUrlResolver = publicUrlResolver;
    }

    /** 미리보기 태그 없는 웹앱 화면 그대로 — 없거나 지운 명함일 때. */
    public String shell() {
        return shell;
    }

    public String render(PublicCardPreview card, String language) {
        String siteName = SupportedLanguages.appName(language);
        String name = hasText(card.getFullName()) ? card.getFullName().trim() : siteName;
        String headline = joinPresent(card.getTitle(), card.getOrganization());
        String description = headline.isEmpty() ? FALLBACK_DESCRIPTIONS.get(language) : headline;
        boolean hasOwnImage = hasText(card.getImageUrl());

        List<String> tags = new ArrayList<>();
        tags.add("<title>" + escape(joinPresent(name, card.getTitle(), card.getOrganization())) + "</title>");
        tags.add(meta("name", "description", description));
        // 명함 링크는 "아는 사람만 본다"가 전제다 — 링크가 공개된 곳에 올라가도 검색 결과에 뜨지 않게 한다.
        tags.add(meta("name", "robots", Robots.NOINDEX));
        tags.add(meta("property", "og:type", "profile"));
        tags.add(meta("property", "og:site_name", siteName));
        tags.add(meta("property", "og:title", name));
        tags.add(meta("property", "og:description", description));
        tags.add(meta("property", "og:url", card.getPageUrl()));
        if (hasOwnImage) {
            tags.add(meta("property", "og:image", card.getImageUrl()));
        } else {
            tags.add(meta("property", "og:image", absolute(DEFAULT_IMAGE_PATH)));
            tags.add(meta("property", "og:image:width", "1200"));
            tags.add(meta("property", "og:image:height", "630"));
        }
        tags.add(meta("name", "twitter:card", "summary_large_image"));

        String html = remove(remove(shell, TITLE), DESCRIPTION);
        int headEnd = html.indexOf(HEAD_END);
        if (headEnd < 0) {
            log.warn("index.html 에 </head> 가 없어 명함 미리보기 태그를 넣지 못했다.");
            return html;
        }
        // 셸의 들여쓰기(</head> 앞 2칸, 태그 4칸)에 맞춘다 — 소스 보기에서 읽기 쉽게.
        String block = "  " + String.join("\n    ", tags) + "\n  ";
        return html.substring(0, headEnd) + block + html.substring(headEnd);
    }

    private String absolute(String path) {
        return publicUrlResolver.baseUriBuilder().path(path).toUriString();
    }

    private static String meta(String attribute, String key, String content) {
        return "<meta " + attribute + "=\"" + key + "\" content=\"" + escape(content) + "\">";
    }

    /**
     * {@code <>&"'} 만 바꾼다. 인코딩을 안 주는 오버로드는 "·" 같은 문자까지 {@code &middot;} 로 바꿔
     * 미리보기 수집기마다 다르게 보일 수 있다 — 응답이 UTF-8 이라 그럴 필요가 없다.
     */
    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
    }

    private static String joinPresent(String... parts) {
        return Stream.of(parts)
                .filter(PublicCardPageRenderer::hasText)
                .map(String::trim)
                .collect(Collectors.joining(SEPARATOR));
    }

    /** 정규식으로 위치만 찾고 문자열을 잘라낸다 — 치환 문자열 해석이 끼어들 틈을 없앤다. */
    private static String remove(String html, Pattern pattern) {
        Matcher matcher = pattern.matcher(html);
        if (!matcher.find()) {
            return html;
        }
        return html.substring(0, matcher.start()) + html.substring(matcher.end());
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String read(Resource indexHtml) {
        if (!indexHtml.exists()) {
            log.error("static/index.html 이 없다 — 프론트 빌드 산출물(static/)을 커밋했는지 확인할 것. "
                    + "명함 링크 미리보기는 최소 셸로 계속 동작한다.");
            return MINIMAL_SHELL;
        }
        try {
            return indexHtml.getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.error("static/index.html 을 읽지 못했다 — 최소 셸로 대신한다.", e);
            return MINIMAL_SHELL;
        }
    }
}
