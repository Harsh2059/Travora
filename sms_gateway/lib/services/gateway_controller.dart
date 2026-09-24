import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../config/app_config.dart';
import '../models/gateway_stats.dart';
import 'backend_service.dart';
import 'permission_service.dart';
import 'sms_service.dart';

enum LogType {
  info,
  success,
  warning,
  error,
}

class LogEntry {
  final DateTime timestamp;
  final LogType type;
  final String message;

  LogEntry({
    required this.timestamp,
    required this.type,
    required this.message,
  });

  String get formattedTime => DateFormat('HH:mm:ss').format(timestamp);
}

class GatewayController extends ChangeNotifier {
  AppConfig _config;
  late BackendService _backendService;

  bool _isRunning = false;
  bool _isProcessing = false;
  bool _isConnected = false;
  String _connectionMessage = 'Connecting...';
  SmsPermissionStatus _permissionStatus = SmsPermissionStatus.unknown;

  int _localSentCount = 0;
  int _localFailedCount = 0;
  GatewayStats _queueStats = GatewayStats();
  String _lastActivity = 'Gateway initialized';
  final List<LogEntry> _logs = [];

  Timer? _pollTimer;

  GatewayController(this._config) {
    _backendService = BackendService(config: _config);
  }

  // Getters
  AppConfig get config => _config;
  bool get isRunning => _isRunning;
  bool get isProcessing => _isProcessing;
  bool get isConnected => _isConnected;
  String get connectionMessage => _connectionMessage;
  SmsPermissionStatus get permissionStatus => _permissionStatus;
  int get localSentCount => _localSentCount;
  int get localFailedCount => _localFailedCount;
  GatewayStats get queueStats => _queueStats;
  String get lastActivity => _lastActivity;
  List<LogEntry> get logs => List.unmodifiable(_logs);

  Future<void> init() async {
    await checkPermission();
    await checkConnection();
    await refreshQueueStats();
    addLog(LogType.info, 'SMS Gateway initialized on device ${_config.deviceId}');
  }

  Future<void> updateConfig(AppConfig newConfig) async {
    _config = newConfig;
    await _config.save();
    _backendService.dispose();
    _backendService = BackendService(config: _config);

    if (_isRunning) {
      // Restart polling with new interval/URL
      _stopPolling();
      _startPolling();
    }

    await checkConnection();
    await refreshQueueStats();
    addLog(LogType.info, 'Configuration updated: URL=${_config.cleanBaseUrl}');
    notifyListeners();
  }

  Future<void> checkPermission() async {
    _permissionStatus = await PermissionService.checkSmsPermission();
    notifyListeners();
  }

  Future<void> requestPermission() async {
    _permissionStatus = await PermissionService.requestSmsPermission();
    if (_permissionStatus == SmsPermissionStatus.granted) {
      addLog(LogType.success, 'Android SMS permission granted');
    } else {
      addLog(LogType.warning, 'Android SMS permission denied');
    }
    notifyListeners();
  }

  Future<void> checkConnection() async {
    final res = await _backendService.checkConnectivity();
    _isConnected = res.isConnected;
    _connectionMessage = res.message;
    notifyListeners();
  }

  Future<void> refreshQueueStats() async {
    try {
      _queueStats = await _backendService.fetchQueueStats();
      notifyListeners();
    } catch (_) {}
  }

  void startGateway() {
    if (_isRunning) return;
    _isRunning = true;
    _lastActivity = 'Gateway started (Polling every ${_config.pollIntervalSeconds}s)';
    addLog(LogType.info, _lastActivity);
    _startPolling();
    // Immediate first tick
    pollOnce();
    notifyListeners();
  }

  void stopGateway() {
    if (!_isRunning) return;
    _stopPolling();
    _isRunning = false;
    _lastActivity = 'Gateway stopped';
    addLog(LogType.info, _lastActivity);
    notifyListeners();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      Duration(seconds: _config.pollIntervalSeconds),
      (_) => _processCycle(),
    );
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> pollOnce() async {
    await _processCycle();
  }

  Future<void> _processCycle() async {
    if (_isProcessing) return;
    _isProcessing = true;
    notifyListeners();

    try {
      // 1. Check permission
      if (_permissionStatus != SmsPermissionStatus.granted) {
        await checkPermission();
        if (_permissionStatus != SmsPermissionStatus.granted) {
          _lastActivity = 'Waiting for SMS permission to be granted...';
          notifyListeners();
          return;
        }
      }

      // 2. Check connectivity
      final connRes = await _backendService.checkConnectivity();
      _isConnected = connRes.isConnected;
      _connectionMessage = connRes.message;

      if (!_isConnected) {
        _lastActivity = 'Backend unreachable, retrying...';
        notifyListeners();
        return;
      }

      // 3. Refresh stats
      await refreshQueueStats();

      // 4. Fetch and claim pending jobs atomically
      final jobs = await _backendService.fetchPendingJobs(
        limit: 5,
        claim: true,
      );

      if (jobs.isEmpty) {
        _lastActivity = 'Idle (No pending SMS jobs)';
        notifyListeners();
        return;
      }

      _lastActivity = 'Processing ${jobs.length} SMS job(s)...';
      addLog(LogType.info, 'Fetched & claimed ${jobs.length} pending SMS job(s)');
      notifyListeners();

      // 5. Process each claimed job
      for (final job in jobs) {
        // Report SENDING
        try {
          await _backendService.reportJobStatus(
            jobId: job.id,
            status: 'SENDING',
          );
        } catch (e) {
          debugPrint('[GatewayController] Failed to mark job as SENDING: $e');
        }

        // Send via Android physical SIM
        addLog(LogType.info, 'Transmitting SMS to ${job.recipient} (Job: ${job.id})');
        final sendResult = await SmsService.sendSms(
          phoneNumber: job.recipient,
          message: job.message,
        );

        if (sendResult.isSuccess) {
          // Report SENT to backend
          try {
            await _backendService.reportJobStatus(
              jobId: job.id,
              status: 'SENT',
            );
            _localSentCount++;
            _lastActivity = 'SMS sent to ${job.recipient}';
            addLog(LogType.success, 'Successfully sent SMS to ${job.recipient} (Job: ${job.id})');
          } catch (e) {
            addLog(LogType.warning, 'SMS sent via SIM, but backend status report failed: $e');
          }
        } else {
          // Report FAILED to backend
          try {
            await _backendService.reportJobStatus(
              jobId: job.id,
              status: 'FAILED',
              errorMessage: sendResult.errorMessage,
            );
            _localFailedCount++;
            _lastActivity = 'Failed sending SMS to ${job.recipient}';
            addLog(LogType.error, 'Failed to send SMS to ${job.recipient}: ${sendResult.errorMessage}');
          } catch (e) {
            addLog(LogType.error, 'SMS failed and backend status report error: $e');
          }
        }

        await refreshQueueStats();
      }
    } catch (e) {
      _lastActivity = 'Polling error: $e';
      debugPrint('[GatewayController Error] _processCycle: $e');
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }

  void addLog(LogType type, String message) {
    _logs.insert(
      0,
      LogEntry(
        timestamp: DateTime.now(),
        type: type,
        message: message,
      ),
    );
    // Keep last 150 log entries in memory
    if (_logs.length > 150) {
      _logs.removeRange(150, _logs.length);
    }
    notifyListeners();
  }

  void clearLogs() {
    _logs.clear();
    addLog(LogType.info, 'Logs cleared');
    notifyListeners();
  }

  @override
  void dispose() {
    _stopPolling();
    _backendService.dispose();
    super.dispose();
  }
}
