class VCardGenerator {
  static String generateVCard(Map<String, dynamic> businessCardData) {
    final buffer = StringBuffer();
    
    // vCard 시작
    buffer.writeln('BEGIN:VCARD');
    buffer.writeln('VERSION:3.0');
    
    // 이름 (필수)
    final fullName = businessCardData['full_name'] ?? '';
    if (fullName.isNotEmpty) {
      buffer.writeln('FN:$fullName');
    }
    
    // N (구조화된 이름)은 대부분 연락처 앱에서 선택사항이므로 생략
    // FN만으로도 충분히 연락처 저장 가능
    
    // 조직
    final organization = businessCardData['organization'] ?? '';
    if (organization.isNotEmpty) {
      buffer.writeln('ORG:$organization');
    }
    
    // 직책
    final title = businessCardData['title'] ?? '';
    if (title.isNotEmpty) {
      buffer.writeln('TITLE:$title');
    }
    
    // 전화번호
    final phone = businessCardData['phone'] ?? '';
    if (phone.isNotEmpty) {
      buffer.writeln('TEL;TYPE=CELL:$phone');
    }
    
    // 이메일
    final email = businessCardData['email'] ?? '';
    if (email.isNotEmpty) {
      buffer.writeln('EMAIL;TYPE=INTERNET:$email');
    }
    
    // 웹사이트
    final website = businessCardData['website'] ?? '';
    if (website.isNotEmpty) {
      buffer.writeln('URL:$website');
    }
    
    // 주소
    final address = businessCardData['address'] ?? '';
    if (address.isNotEmpty) {
      // ADR 형식: ;;street;city;state;postal;country
      buffer.writeln('ADR;TYPE=WORK:;;$address;;;;');
    }
    
    // 메모
    final note = businessCardData['note'] ?? '';
    if (note.isNotEmpty) {
      buffer.writeln('NOTE:$note');
    }

    // 생성일
    final now = DateTime.now();
    final timestamp = now.toIso8601String().replaceAll(RegExp(r'[-:]'), '').split('.')[0] + 'Z';
    buffer.writeln('REV:$timestamp');
    
    // vCard 끝
    buffer.writeln('END:VCARD');
    
    return buffer.toString();
  }
}