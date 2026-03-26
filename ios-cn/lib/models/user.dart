class User {
  final String id;
  final String email;
  final String phone;
  final String fullName;
  final String company;
  final String jobTitle;
  final String userRole;
  final String subscriptionTier;
  final int apiCallsToday;
  final int apiCallsLimit;

  User({
    required this.id,
    required this.email,
    required this.phone,
    required this.fullName,
    required this.company,
    required this.jobTitle,
    required this.userRole,
    required this.subscriptionTier,
    required this.apiCallsToday,
    required this.apiCallsLimit,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      fullName: json['fullName'] ?? '',
      company: json['company'] ?? '',
      jobTitle: json['jobTitle'] ?? '',
      userRole: json['userRole'] ?? '',
      subscriptionTier: json['subscriptionTier'] ?? 'free',
      apiCallsToday: json['apiCallsToday'] ?? 0,
      apiCallsLimit: json['apiCallsLimit'] ?? 100,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'phone': phone,
      'fullName': fullName,
      'company': company,
      'jobTitle': jobTitle,
      'userRole': userRole,
      'subscriptionTier': subscriptionTier,
      'apiCallsToday': apiCallsToday,
      'apiCallsLimit': apiCallsLimit,
    };
  }

  User copyWith({
    String? id,
    String? email,
    String? phone,
    String? fullName,
    String? company,
    String? jobTitle,
    String? userRole,
    String? subscriptionTier,
    int? apiCallsToday,
    int? apiCallsLimit,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      fullName: fullName ?? this.fullName,
      company: company ?? this.company,
      jobTitle: jobTitle ?? this.jobTitle,
      userRole: userRole ?? this.userRole,
      subscriptionTier: subscriptionTier ?? this.subscriptionTier,
      apiCallsToday: apiCallsToday ?? this.apiCallsToday,
      apiCallsLimit: apiCallsLimit ?? this.apiCallsLimit,
    );
  }
}
