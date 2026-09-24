import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  static const String _keyBaseUrl = 'travora_sms_backend_url';
  static const String _keyDeviceId = 'travora_sms_device_id';
  static const String _keyPollInterval = 'travora_sms_poll_interval';

  // Defaults:
  // On a physical device use the host machine's LAN IP (same Wi-Fi network).
  // 10.0.2.2 only works inside an Android emulator (it maps to host loopback).
  static const String defaultBaseUrl = 'http://192.168.0.103:8000';
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
    var url = prefs.getString(_keyBaseUrl) ?? defaultBaseUrl;

    // Auto-migrate: if the stored value is the emulator loopback alias, replace
    // it with the current default so physical devices connect correctly.
    if (url == 'http://10.0.2.2:8000') {
      url = defaultBaseUrl;
      await prefs.setString(_keyBaseUrl, url);
    }

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
