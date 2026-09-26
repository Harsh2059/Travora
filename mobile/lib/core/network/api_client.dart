import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'api_endpoints.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  final http.Client _client = http.Client();
  final Duration _timeout = const Duration(seconds: 15);
  final _storage = const FlutterSecureStorage();

  Future<dynamic> get(String endpoint, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint').replace(queryParameters: queryParams);
    final hdrs = await _headers();
    return _request(() => _client.get(uri, headers: hdrs));
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint');
    final hdrs = await _headers();
    return _request(() => _client.post(uri, headers: hdrs, body: jsonEncode(body ?? {})));
  }

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint');
    final hdrs = await _headers();
    return _request(() => _client.patch(uri, headers: hdrs, body: jsonEncode(body ?? {})));
  }

  Future<dynamic> _request(Future<http.Response> Function() requestFunc) async {
    try {
      final response = await requestFunc().timeout(_timeout);
      if (kDebugMode) {
        debugPrint('API RESPONSE [${response.statusCode}] ${response.request?.url}');
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (response.body.isEmpty) return {};
        return jsonDecode(response.body);
      } else {
        throw ApiException(response.statusCode, response.body);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('API ERROR: $e');
      rethrow;
    }
  }

  Future<Map<String, String>> _headers() async {
    final session = Supabase.instance.client.auth.currentSession;
    final token = session?.accessToken;
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }
}
