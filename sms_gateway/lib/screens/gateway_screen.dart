import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../services/gateway_controller.dart';
import '../services/permission_service.dart';

class GatewayScreen extends StatefulWidget {
  final GatewayController controller;

  const GatewayScreen({
    Key? key,
    required this.controller,
  }) : super(key: key);

  @override
  State<GatewayScreen> createState() => _GatewayScreenState();
}

class _GatewayScreenState extends State<GatewayScreen> {
  GatewayController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    controller.addListener(_onControllerUpdate);
  }

  @override
  void dispose() {
    controller.removeListener(_onControllerUpdate);
    super.dispose();
  }

  void _onControllerUpdate() {
    if (mounted) {
      setState(() {});
    }
  }

  void _showSettingsDialog() {
    final urlController = TextEditingController(text: controller.config.baseUrl);
    final deviceController = TextEditingController(text: controller.config.deviceId);
    final intervalController = TextEditingController(
      text: controller.config.pollIntervalSeconds.toString(),
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Gateway Configuration'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: urlController,
                decoration: const InputDecoration(
                  labelText: 'Backend Base URL',
                  hintText: 'http://10.0.2.2:8000 or http://192.168.1.50:8000',
                  helperText: 'Emulator uses 10.0.2.2; Real device uses LAN IP',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: deviceController,
                decoration: const InputDecoration(
                  labelText: 'Gateway Device ID',
                  hintText: 'SMS_GATEWAY_01',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: intervalController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Polling Interval (seconds)',
                  hintText: '5',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = urlController.text.trim();
              final newDevice = deviceController.text.trim();
              final newInterval = int.tryParse(intervalController.text.trim()) ?? 5;

              if (newUrl.isNotEmpty && newDevice.isNotEmpty) {
                final newConfig = AppConfig(
                  baseUrl: newUrl,
                  deviceId: newDevice,
                  pollIntervalSeconds: newInterval,
                );
                await controller.updateConfig(newConfig);
                if (mounted) Navigator.pop(ctx);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isOnline = controller.isRunning;
    final isConnected = controller.isConnected;
    final isPermissionGranted = controller.permissionStatus == SmsPermissionStatus.granted;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Travora SMS Gateway',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: 'Configure Backend URL',
            onPressed: _showSettingsDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Status Overview Banner
              _buildStatusBanner(isOnline, isConnected, isPermissionGranted),
              const SizedBox(height: 16),

              // 2. Metrics Cards
              _buildMetricsSection(),
              const SizedBox(height: 16),

              // 3. Gateway Controls
              _buildActionControls(isOnline, isPermissionGranted),
              const SizedBox(height: 16),

              // 4. Live Activity Log
              _buildLogSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBanner(bool isOnline, bool isConnected, bool isPermissionGranted) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Status row 1: Gateway Engine
            _buildStatusRow(
              title: 'Gateway Engine',
              value: isOnline ? 'ONLINE (RUNNING)' : 'OFFLINE (STOPPED)',
              color: isOnline ? Colors.green : Colors.grey,
              icon: isOnline ? Icons.play_circle_fill : Icons.pause_circle_filled,
            ),
            const Divider(height: 20),

            // Status row 2: Backend
            _buildStatusRow(
              title: 'Backend API',
              value: isConnected ? 'CONNECTED' : 'DISCONNECTED',
              subtitle: controller.config.cleanBaseUrl,
              color: isConnected ? Colors.green : Colors.red,
              icon: isConnected ? Icons.cloud_done : Icons.cloud_off,
            ),
            const Divider(height: 20),

            // Status row 3: SMS Permission
            _buildStatusRow(
              title: 'SIM / SMS Permission',
              value: isPermissionGranted ? 'GRANTED' : 'REQUIRED / DENIED',
              color: isPermissionGranted ? Colors.green : Colors.orange,
              icon: isPermissionGranted ? Icons.sim_card : Icons.sim_card_alert,
              trailing: isPermissionGranted
                  ? null
                  : TextButton(
                      onPressed: () => controller.requestPermission(),
                      child: const Text('Grant'),
                    ),
            ),
            const Divider(height: 20),

            // Status row 4: Device ID
            _buildStatusRow(
              title: 'Gateway Device ID',
              value: controller.config.deviceId,
              color: Colors.blueGrey,
              icon: Icons.phone_android,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusRow({
    required String title,
    required String value,
    String? subtitle,
    required Color color,
    required IconData icon,
    Widget? trailing,
  }) {
    return Row(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w500),
              ),
              Text(
                value,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
              ),
              if (subtitle != null)
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: Colors.blueGrey),
                ),
            ],
          ),
        ),
        if (trailing != null) trailing,
      ],
    );
  }

  Widget _buildMetricsSection() {
    final queue = controller.queueStats;
    return Row(
      children: [
        Expanded(
          child: _buildMetricCard(
            label: 'Pending',
            count: queue.pending,
            color: Colors.orange,
            icon: Icons.hourglass_top,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricCard(
            label: 'Sent (SIM)',
            count: controller.localSentCount,
            color: Colors.green,
            icon: Icons.check_circle_outline,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricCard(
            label: 'Failed',
            count: controller.localFailedCount,
            color: Colors.red,
            icon: Icons.error_outline,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required String label,
    required int count,
    required Color color,
    required IconData icon,
  }) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14.0, horizontal: 8.0),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(
              count.toString(),
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionControls(bool isOnline, bool isPermissionGranted) {
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: isOnline
              ? ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => controller.stopGateway(),
                  icon: const Icon(Icons.stop),
                  label: const Text('STOP GATEWAY', style: TextStyle(fontWeight: FontWeight.bold)),
                )
              : ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isPermissionGranted
                      ? () => controller.startGateway()
                      : () async {
                          await controller.requestPermission();
                          if (controller.permissionStatus == SmsPermissionStatus.granted) {
                            controller.startGateway();
                          }
                        },
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('START GATEWAY', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: controller.isProcessing ? null : () => controller.pollOnce(),
            icon: controller.isProcessing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
            label: const Text('Poll Now'),
          ),
        ),
      ],
    );
  }

  Widget _buildLogSection() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.terminal, size: 20, color: Colors.blueGrey),
                    SizedBox(width: 6),
                    Text(
                      'Gateway Activity Log',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () => controller.clearLogs(),
                  child: const Text('Clear', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
            const Divider(height: 8),
            Container(
              height: 240,
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E),
                borderRadius: BorderRadius.circular(8),
              ),
              child: controller.logs.isEmpty
                  ? const Center(
                      child: Text(
                        'No activity yet. Press Start Gateway to begin dispatching.',
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    )
                  : ListView.builder(
                      itemCount: controller.logs.length,
                      padding: const EdgeInsets.all(8.0),
                      itemBuilder: (ctx, index) {
                        final log = controller.logs[index];
                        Color color = Colors.white70;
                        if (log.type == LogType.success) color = Colors.greenAccent;
                        if (log.type == LogType.error) color = Colors.redAccent;
                        if (log.type == LogType.warning) color = Colors.orangeAccent;
                        if (log.type == LogType.info) color = Colors.lightBlueAccent;

                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2.0),
                          child: Text(
                            '[${log.formattedTime}] ${log.message}',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: color,
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
