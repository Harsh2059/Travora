import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum SmsPermissionStatus {
  granted,
  denied,
  unknown,
}

class PermissionService {
  static const MethodChannel _channel = MethodChannel('com.travora.sms_gateway/sms');

  static Future<SmsPermissionStatus> checkSmsPermission() async {
    if (!kIsWeb && !Platform.isAndroid) {
      // In non-Android mock / testing environments, treat as granted
      return SmsPermissionStatus.granted;
    }

    try {
      final bool isGranted = await _channel.invokeMethod('checkPermission') ?? false;
      return isGranted ? SmsPermissionStatus.granted : SmsPermissionStatus.denied;
    } catch (e) {
      debugPrint('[PermissionService Error] checkSmsPermission failed: $e');
      return SmsPermissionStatus.unknown;
    }
  }

  static Future<SmsPermissionStatus> requestSmsPermission() async {
    if (!kIsWeb && !Platform.isAndroid) {
      return SmsPermissionStatus.granted;
    }

    try {
      final bool isGranted = await _channel.invokeMethod('requestPermission') ?? false;
      return isGranted ? SmsPermissionStatus.granted : SmsPermissionStatus.denied;
    } catch (e) {
      debugPrint('[PermissionService Error] requestSmsPermission failed: $e');
      return SmsPermissionStatus.unknown;
    }
  }
}
