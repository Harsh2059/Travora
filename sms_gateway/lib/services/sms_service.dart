import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum SmsSendStatus {
  success,
  failed,
}

class SmsSendResult {
  final SmsSendStatus status;
  final String? errorMessage;

  SmsSendResult.success()
      : status = SmsSendStatus.success,
        errorMessage = null;

  SmsSendResult.failed(this.errorMessage)
      : status = SmsSendStatus.failed;

  bool get isSuccess => status == SmsSendStatus.success;

  @override
  String toString() {
    return isSuccess ? 'SUCCESS' : 'FAILED ($errorMessage)';
  }
}

class SmsService {
  static const MethodChannel _channel = MethodChannel('com.travora.sms_gateway/sms');

  /// Sends an SMS message to the given [phoneNumber] via the Android device's physical SIM card.
  /// Returns [SmsSendResult.success()] or [SmsSendResult.failed(reason)].
  static Future<SmsSendResult> sendSms({
    required String phoneNumber,
    required String message,
  }) async {
    final cleanPhone = phoneNumber.replaceAll(' ', '').trim();
    final cleanMsg = message.trim();

    if (cleanPhone.isEmpty) {
      return SmsSendResult.failed('Recipient phone number is empty');
    }
    if (cleanMsg.isEmpty) {
      return SmsSendResult.failed('SMS message body is empty');
    }

    // Platform validation
    if (!kIsWeb && !Platform.isAndroid) {
      // Running on non-Android platform (e.g. desktop/iOS/testing)
      debugPrint('[SmsService Mock] Non-Android environment, simulating send to $cleanPhone: $cleanMsg');
      return SmsSendResult.success();
    }

    try {
      final dynamic result = await _channel.invokeMethod('sendSms', {
        'phoneNumber': cleanPhone,
        'message': cleanMsg,
      });

      if (result is Map) {
        final success = result['success'] as bool? ?? false;
        final error = result['error'] as String?;
        if (success) {
          return SmsSendResult.success();
        } else {
          return SmsSendResult.failed(error ?? 'Unknown Android SMS failure');
        }
      }

      return SmsSendResult.success();
    } on PlatformException catch (pe) {
      debugPrint('[SmsService Error] PlatformException: ${pe.code} - ${pe.message}');
      return SmsSendResult.failed('${pe.code}: ${pe.message ?? "Platform SMS error"}');
    } catch (e) {
      debugPrint('[SmsService Error] Unexpected exception: $e');
      return SmsSendResult.failed(e.toString());
    }
  }
}
