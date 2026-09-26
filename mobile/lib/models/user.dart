class User {
  final String id;
  final String name;
  final String email;
  final String? whatsappPhone;
  final bool smsEnabled;
  final bool whatsappEnabled;

  User({
    required this.id,
    required this.name,
    required this.email,
    this.whatsappPhone,
    this.smsEnabled = true,
    this.whatsappEnabled = true,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'].toString(),
      name: json['name'],
      email: json['email'],
      whatsappPhone: json['whatsapp_phone'],
      smsEnabled: json['sms_enabled'] ?? true,
      whatsappEnabled: json['whatsapp_enabled'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'email': email,
      'whatsapp_phone': whatsappPhone,
      'sms_enabled': smsEnabled,
      'whatsapp_enabled': whatsappEnabled,
    };
  }
}
