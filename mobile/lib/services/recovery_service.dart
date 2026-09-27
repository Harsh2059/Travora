import 'package:flutter/foundation.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/recovery_option.dart';

class RecoveryService {
  final ApiClient _apiClient = ApiClient();
  static const Duration _recoveryExecutionTimeout = Duration(seconds: 45);

  Future<List<RecoveryOption>> getRecoveryOptions(int tripId) async {
    // Increased timeout to 60 seconds since recovery analysis can take longer
    try {
      final response = await _apiClient.post(
        ApiEndpoints.tripRecoveryOptions(tripId),
        timeout: const Duration(seconds: 60),
      );
      if (response is List) {
        return response.map((e) => RecoveryOption.fromJson(e)).toList();
      } else if (response is Map<String, dynamic>) {
        if (response['plans'] != null) {
          return (response['plans'] as List).map((e) => RecoveryOption.fromJson(e)).toList();
        } else if (response['options'] != null) {
          return (response['options'] as List).map((e) => RecoveryOption.fromJson(e)).toList();
        }
      }
      if (kDebugMode) {
        debugPrint('[RECOVERY] Unexpected response format: $response');
      }
      return [];
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[RECOVERY] Error fetching recovery options for trip $tripId: $e');
      }
      rethrow;
    }
  }

  Future<RecoveryExecution> executeRecovery(int tripId, RecoveryOption option) async {
    final response = await _apiClient.post(
      ApiEndpoints.executeRecovery(tripId),
      body: {'selectedPlan': option.metadata},
      timeout: _recoveryExecutionTimeout,
    );
    return RecoveryExecution.fromJson(response);
  }

  Future<RecoveryExecution?> getLatestExecution(int tripId) async {
    try {
      final response = await _apiClient.get(ApiEndpoints.recoveryExecution(tripId));
      return RecoveryExecution.fromJson(response);
    } catch (e) {
      return null;
    }
  }
}
