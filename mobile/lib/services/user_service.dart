import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config/app_config.dart';
import '../models/user.dart';

class UserService {
  Future<User> getUserProfile(int userId) async {
    final response = await http.get(Uri.parse('${AppConfig.apiBaseUrl}/api/users/$userId/profile'));
    if (response.statusCode == 200) {
      return User.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to load user profile');
    }
  }

  Future<User> updateUserProfile(int userId, Map<String, dynamic> updates) async {
    final response = await http.put(
      Uri.parse('${AppConfig.apiBaseUrl}/api/users/$userId/profile'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(updates),
    );
    if (response.statusCode == 200) {
      return User.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to update user profile');
    }
  }
}
