import 'package:businesscard_qr/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// 다국어 배선이 살아 있는지 지키는 회귀 테스트.
///
/// ARB 를 하나 빠뜨리거나 delegate 를 빼먹으면 앱은 조용히 영어로만 뜬다.
/// 화면 테스트가 아니라 "6개 언어가 실제로 각자의 문장을 돌려주는가"만 본다.
void main() {
  /// 주어진 로케일로 앱을 띄우고 그 언어의 [AppLocalizations] 를 꺼낸다.
  Future<AppLocalizations> localizationsFor(
    WidgetTester tester,
    Locale locale,
  ) async {
    late AppLocalizations captured;
    await tester.pumpWidget(
      MaterialApp(
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) {
            captured = AppLocalizations.of(context);
            return const SizedBox.shrink();
          },
        ),
      ),
    );
    return captured;
  }

  test('스토어에 알린 6개 언어를 모두 지원한다', () {
    final codes = AppLocalizations.supportedLocales
        .map((locale) => locale.languageCode)
        .toSet();
    expect(codes, containsAll(<String>['en', 'ko', 'ja', 'zh', 'es', 'de']));
  });

  testWidgets('언어마다 실제로 다른 문장을 돌려준다', (tester) async {
    // 같은 키가 모든 언어에서 같은 문자열이면 ARB 가 안 채워졌다는 뜻이다.
    final greetings = <String>{};
    for (final locale in AppLocalizations.supportedLocales) {
      final l10n = await localizationsFor(tester, locale);
      expect(
        l10n.emptyCardsTitle,
        isNotEmpty,
        reason: '${locale.languageCode} 의 emptyCardsTitle 이 비어 있다',
      );
      greetings.add(l10n.emptyCardsTitle);
    }
    expect(greetings.length, AppLocalizations.supportedLocales.length);
  });

  testWidgets('앱 이름은 한국어만 한글, 나머지는 영문 브랜드명이다', (tester) async {
    final ko = await localizationsFor(tester, const Locale('ko'));
    final en = await localizationsFor(tester, const Locale('en'));
    final ja = await localizationsFor(tester, const Locale('ja'));

    expect(ko.appTitle, '명함QR');
    expect(en.appTitle, 'Businesscard QR');
    expect(ja.appTitle, 'Businesscard QR');
  });

  testWidgets('자리표시자가 있는 문장은 값을 실제로 끼워 넣는다', (tester) async {
    final ko = await localizationsFor(tester, const Locale('ko'));

    expect(ko.cardsShareSubtitle(3), contains('3'));
    expect(ko.deleteCardMessage('홍길동'), contains('홍길동'));
    expect(ko.errorServer(503), contains('503'));
    expect(ko.cardLimitReachedTitle(3), contains('3'));
  });

  testWidgets('지원하지 않는 언어는 기본 언어(영어)로 떨어진다', (tester) async {
    final l10n = await localizationsFor(tester, const Locale('fr'));
    expect(l10n.appTitle, 'Businesscard QR');
  });
}
