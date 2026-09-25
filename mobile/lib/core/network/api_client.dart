import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
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

  Future<dynamic> get(String endpoint, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint').replace(queryParameters: queryParams);
    return _request(() => _client.get(uri));
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint');
    return _request(() => _client.post(uri, headers: _headers(), body: jsonEncode(body ?? {})));
  }

  Future<dynamic> patch(String endpoint, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('${ApiEndpoints.baseUrl}$endpoint');
    return _request(() => _client.patch(uri, headers: _headers(), body: jsonEncode(body ?? {})));
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

  Map<String, String> _headers() => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}
