import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../widgets/travora_card.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Alerts', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final disruptions = provider.activeDisruptions;
          final lastExecution = provider.lastExecution;

          if (disruptions.isEmpty && lastExecution == null) {
            return _buildEmptyState(context);
          }

          return ListView(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            children: [
              Text('Stay updated on your journeys', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16, fontWeight: FontWeight.w500)),
              SizedBox(height: 24),
              
              if (lastExecution != null)
                _buildResolvedCard(context, 'Recovery Executed', 'Status: ${lastExecution.status}', 'Just now'),
                
              ...disruptions.map((d) {
                final isCancel = d.disruptionType.toLowerCase().contains('cancel');
                final title = d.disruptionType.replaceAll('_', ' ').toUpperCase();
                final color = isCancel ? const Color(0xFFDC2626) : const Color(0xFFF59E0B);
                final icon = isCancel ? Icons.cancel : Icons.warning_rounded;
                
                return _buildAlertCard(context, icon, color, title, d.description, 'Action required', () => context.push('/impact'));
              }),
            ],
          );
        },
      ),
    );
  }

  Widget _buildAlertCard(BuildContext context, IconData icon, Color color, String title, String msg, String time, VoidCallback onTap) {
    return TravoraCard(
      padding: EdgeInsets.all(20),
      border: Border.all(color: color.withValues(alpha: 0.3)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              SizedBox(width: 8),
              Expanded(child: Text(title, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.5))),
              Text(time, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 12)),
            ],
          ),
          SizedBox(height: 12),
          Text(msg, style: Theme.of(context).textTheme.bodyLarge),
          SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: onTap,
              style: OutlinedButton.styleFrom(
                foregroundColor: color,
                side: BorderSide(color: color),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('View Impact'),
            ),
          )
        ],
      ),
    );
  }
  
  Widget _buildResolvedCard(BuildContext context, String title, String msg, String time) {
    return Padding(
      padding: EdgeInsets.only(bottom: 16),
      child: TravoraCard(
        padding: EdgeInsets.all(20),
        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.check_circle, color: const Color(0xFF10B981), size: 20),
                SizedBox(width: 8),
                Expanded(child: Text(title, style: TextStyle(color: const Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 14))),
                Text(time, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 12)),
              ],
            ),
            SizedBox(height: 12),
            Text(msg, style: Theme.of(context).textTheme.bodyLarge),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: EdgeInsets.all(24),
            decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
            child: Icon(Icons.notifications_none, size: 64, color: Colors.grey),
          ),
          SizedBox(height: 32),
          Text("You're all caught up", style: Theme.of(context).textTheme.headlineLarge),
          SizedBox(height: 12),
          Text('No active travel alerts.', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
        ],
      ),
    );
  }
}
