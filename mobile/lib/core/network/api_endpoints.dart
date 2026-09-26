import '../config/app_config.dart';

class ApiEndpoints {
  static String get baseUrl => AppConfig.apiBaseUrl;

  static const String health = '/api/health';
  static const String users = '/api/users';
  static String userTrips(String userId) => '/api/users/$userId/trips';
  static String tripDetails(int tripId) => '/api/trips/$tripId';
  static String tripItems(int tripId) => '/api/trips/$tripId/items';
  
  static String tripDisruptions(int tripId) => '/api/trips/$tripId/disruptions';
  static String tripImpact(int tripId) => '/api/trips/$tripId/impact';
  static String tripRecoveryOptions(int tripId) => '/api/trips/$tripId/recovery/options';
  static String executeRecovery(int tripId) => '/api/trips/$tripId/recovery/execute';
  static String recoveryExecution(int tripId) => '/api/trips/$tripId/recovery/execution';
}
