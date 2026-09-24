import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  static const String _keyBaseUrl = 'travora_sms_backend_url';
  static const String _keyDeviceId = 'travora_sms_device_id';
  static const String _keyPollInterval = 'travora_sms_poll_interval';

  // Defaults:
  // 10.0.2.2 is standard Android emulator loopback alias to host machine.
  // For physical device on Wi-Fi, user configures their machine's LAN IP.
  static const String defaultBaseUrl = 'http://10.0.2.2:8000';
  static const String defaultDeviceId = 'SMS_GATEWAY_01';
  static const int defaultPollIntervalSeconds = 5;

  String baseUrl;
  String deviceId;
  int pollIntervalSeconds;

  AppConfig({
    required this.baseUrl,
    required this.deviceId,
    required this.pollIntervalSeconds,
  });

  static Future<AppConfig> load() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString(_keyBaseUrl) ?? defaultBaseUrl;
    final devId = prefs.getString(_keyDeviceId) ?? defaultDeviceId;
    final interval = prefs.getInt(_keyPollInterval) ?? defaultPollIntervalSeconds;

    return AppConfig(
      baseUrl: url,
      deviceId: devId,
      pollIntervalSeconds: interval,
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyBaseUrl, baseUrl.trim());
    await prefs.setString(_keyDeviceId, deviceId.trim());
    await prefs.setInt(_keyPollInterval, pollIntervalSeconds);
  }

  String get cleanBaseUrl {
    var url = baseUrl.trim();
    if (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }
    return url;
  }
}
