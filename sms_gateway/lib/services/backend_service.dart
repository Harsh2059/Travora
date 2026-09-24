import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/sms_job.dart';
import '../models/gateway_stats.dart';

class BackendConnectionResult {
  final bool isConnected;
  final String message;

  BackendConnectionResult(this.isConnected, this.message);
}

class BackendService {
  final AppConfig config;
  final http.Client _client;

  BackendService({
    required this.config,
    http.Client? client,
  }) : _client = client ?? http.Client();

  /// Checks whether the backend API is reachable and responding.
  Future<BackendConnectionResult> checkConnectivity() async {
    try {
      final uri = Uri.parse('${config.cleanBaseUrl}/api/health');
      final response = await _client.get(uri).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        return BackendConnectionResult(true, 'Connected to Travora API');
      } else {
        return BackendConnectionResult(
          false,
          'Backend returned status code ${response.statusCode}',
        );
      }
    } catch (e) {
      return BackendConnectionResult(false, 'Cannot reach ${config.cleanBaseUrl}: $e');
    }
  }

  /// Fetches pending SMS jobs from backend, atomically claiming them if [claim] is true.
  Future<List<SmsJob>> fetchPendingJobs({
    int limit = 10,
    bool claim = true,
  }) async {
    final queryParams = {
      'status': 'PENDING',
      'limit': limit.toString(),
      'claim': claim ? 'true' : 'false',
      'device_id': config.deviceId,
    };

    final uri = Uri.parse('${config.cleanBaseUrl}/api/sms-gateway/jobs')
        .replace(queryParameters: queryParams);

    try {
      final response = await _client.get(uri).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final dynamic body = jsonDecode(response.body);
        if (body is List) {
          return body.map((item) => SmsJob.fromJson(item as Map<String, dynamic>)).toList();
        }
        return [];
      } else {
        debugPrint('[BackendService] fetchPendingJobs returned status ${response.statusCode}: ${response.body}');
        throw Exception('Server error ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('[BackendService Error] fetchPendingJobs failed: $e');
      rethrow;
    }
  }

  /// Reports updated status (e.g. SENDING, SENT, FAILED) for an SMS job back to the backend.
  Future<SmsJob> reportJobStatus({
    required String jobId,
    required String status,
    String? errorMessage,
  }) async {
    final uri = Uri.parse('${config.cleanBaseUrl}/api/sms-gateway/jobs/$jobId/status');
    final payload = {
      'status': status.toUpperCase(),
      'error_message': errorMessage,
      'gateway_device_id': config.deviceId,
    };

    try {
      final response = await _client
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final dynamic body = jsonDecode(response.body);
        return SmsJob.fromJson(body as Map<String, dynamic>);
      } else {
        debugPrint('[BackendService] reportJobStatus failed (${response.statusCode}): ${response.body}');
        throw Exception('Status update failed (${response.statusCode}): ${response.body}');
      }
    } catch (e) {
      debugPrint('[BackendService Error] reportJobStatus error for job $jobId: $e');
      rethrow;
    }
  }

  /// Fetches queue telemetry from the backend.
  Future<GatewayStats> fetchQueueStats() async {
    final uri = Uri.parse('${config.cleanBaseUrl}/api/sms-gateway/stats');

    try {
      final response = await _client.get(uri).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final dynamic body = jsonDecode(response.body);
        return GatewayStats.fromJson(body as Map<String, dynamic>);
      }
      return GatewayStats();
    } catch (e) {
      debugPrint('[BackendService Error] fetchQueueStats failed: $e');
      return GatewayStats();
    }
  }

  void dispose() {
    _client.close();
  }
}
