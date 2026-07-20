/// 명함 목록 페이징 응답 (백엔드 PageResponse 매핑 — content/last 만 사용)
class BusinessCardPage {
  final List<BusinessCard> cards;
  final bool last; // 마지막 페이지 여부 (무한스크롤 종료 판단)

  BusinessCardPage({required this.cards, required this.last});

  factory BusinessCardPage.fromJson(Map<String, dynamic> json) {
    final content = json['content'];
    return BusinessCardPage(
      cards: content is List
          ? content
                .whereType<Map<String, dynamic>>()
                .map(BusinessCard.fromJson)
                .toList()
          : [],
      last: json['last'] ?? true,
    );
  }
}

class BusinessCard {
  final String? id;
  final String? userId;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String fullName;
  final String? structuredName;
  final String? phone;
  final String? email;
  final String? website;
  final String? organization;
  final String? title;
  final String? address;
  final String? note;
  final String? vcfDownloadUrl;
  final String? businessCardImageUrl;
  final bool isActive;
  final int viewCount;

  BusinessCard({
    this.id,
    this.userId,
    this.createdAt,
    this.updatedAt,
    required this.fullName,
    this.structuredName,
    this.phone,
    this.email,
    this.website,
    this.organization,
    this.title,
    this.address,
    this.note,
    this.vcfDownloadUrl,
    this.businessCardImageUrl,
    this.isActive = true,
    this.viewCount = 0,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'full_name': fullName,
      'structured_name': structuredName,
      'phone': phone,
      'email': email,
      'website': website,
      'organization': organization,
      'title': title,
      'address': address,
      'note': note,
      'vcf_download_url': vcfDownloadUrl,
      'business_card_image_url': businessCardImageUrl,
      'is_active': isActive,
      'view_count': viewCount,
    };
  }

  factory BusinessCard.fromJson(Map<String, dynamic> json) {
    return BusinessCard(
      id: json['id'],
      userId: json['user_id'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
      fullName: json['full_name'] ?? '',
      structuredName: json['structured_name'],
      phone: json['phone'],
      email: json['email'],
      website: json['website'],
      organization: json['organization'],
      title: json['title'],
      address: json['address'],
      note: json['note'],
      vcfDownloadUrl: json['vcf_download_url'],
      businessCardImageUrl: json['business_card_image_url'],
      isActive: json['is_active'] ?? true,
      viewCount: json['view_count'] ?? 0,
    );
  }

  BusinessCard copyWith({
    String? id,
    String? userId,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? fullName,
    String? structuredName,
    String? phone,
    String? email,
    String? website,
    String? organization,
    String? title,
    String? address,
    String? note,
    String? vcfDownloadUrl,
    String? businessCardImageUrl,
    bool? isActive,
    int? viewCount,
  }) {
    return BusinessCard(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      fullName: fullName ?? this.fullName,
      structuredName: structuredName ?? this.structuredName,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      website: website ?? this.website,
      organization: organization ?? this.organization,
      title: title ?? this.title,
      address: address ?? this.address,
      note: note ?? this.note,
      vcfDownloadUrl: vcfDownloadUrl ?? this.vcfDownloadUrl,
      businessCardImageUrl: businessCardImageUrl ?? this.businessCardImageUrl,
      isActive: isActive ?? this.isActive,
      viewCount: viewCount ?? this.viewCount,
    );
  }
}