import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/network/api_endpoints.dart';
// We'll assume TripProvider has this or we need to extract it

class AuthService {
  final _storage = const FlutterSecureStorage();
  
  static const String _tokenKey = 'auth_token';
  static const String _userIdKey = 'user_id';

  Future<String?> getToken() async {
    return await _storage.read(key: _tokenKey);
  }

  Future<void> _saveSession(String token, String userId) async {
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userIdKey, value: userId);
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userIdKey);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiEndpoints.baseUrl}/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final token = data['access_token'];
        final userId = data['user_id'].toString();
        
        await _saveSession(token, userId);
        return {'success': true, 'userId': userId};
      } else if (response.statusCode == 404) {
         return {'success': false, 'message': 'Authentication endpoints are not yet configured on the backend.'};
      } else {
        final error = json.decode(response.body);
        return {'success': false, 'message': error['detail'] ?? 'Invalid credentials. Please try again.'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Unable to connect. Please check your internet connection.'};
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password, String phone) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiEndpoints.baseUrl}/api/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'name': name,
          'email': email,
          'password': password,
          'phone': phone,
        }),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Auto login might happen or backend returns token directly
        final data = json.decode(response.body);
        if (data.containsKey('access_token')) {
          final token = data['access_token'];
          final userId = data['user_id'].toString();
          await _saveSession(token, userId);
          return {'success': true, 'userId': userId};
        }
        return {'success': true, 'requiresLogin': true};
      } else if (response.statusCode == 404) {
         return {'success': false, 'message': 'Authentication endpoints are not yet configured on the backend.'};
      } else {
        final error = json.decode(response.body);
        return {'success': false, 'message': error['detail'] ?? 'Registration failed.'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Unable to connect. Please check your internet connection.'};
    }
  }

  Future<Map<String, dynamic>> verifySession() async {
    final token = await getToken();
    if (token == null) return {'valid': false};

    try {
      final response = await http.get(
        Uri.parse('${ApiEndpoints.baseUrl}/api/auth/me'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token'
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return {'valid': true, 'user': json.decode(response.body)};
      } else {
        await clearSession();
        return {'valid': false};
      }
    } catch (e) {
      // If network fails but we have a token, we could potentially allow offline access, 
      // but for strict auth, we assume invalid if we can't verify unless we implement offline caching.
      return {'valid': false, 'offline': true}; 
    }
  }
}
