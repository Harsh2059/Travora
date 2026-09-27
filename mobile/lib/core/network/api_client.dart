import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
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
  final Duration _defaultTimeout = const Duration(seconds: 15);

  Future<dynamic> get(String endpoint, {Map<String, String>? queryParams, Duration? timeout}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint').replace(queryParameters: queryParams);
    final hdrs = await _headers();
    return _request(() => _client.get(uri, headers: hdrs), timeout ?? _defaultTimeout);
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body, Duration? timeout}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint');
    final hdrs = await _headers();
    return _request(() => _client.post(uri, headers: hdrs, body: jsonEncode(body ?? {})), timeout ?? _defaultTimeout);
  }

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body, Duration? timeout}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint');
    final hdrs = await _headers();
    return _request(() => _client.patch(uri, headers: hdrs, body: jsonEncode(body ?? {})), timeout ?? _defaultTimeout);
  }

  Future<dynamic> _request(Future<http.Response> Function() requestFunc, Duration timeout) async {
    try {
      final response = await requestFunc().timeout(timeout);
      if (kDebugMode) {
        debugPrint('API RESPONSE [${response.statusCode}] ${response.request?.url}');
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (response.body.isEmpty) return {};
        return jsonDecode(response.body);
      } else if (response.statusCode == 401) {
        // Token expired or invalid - trigger auth state change
        throw ApiException(response.statusCode, 'Session expired. Please log in again.');
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
