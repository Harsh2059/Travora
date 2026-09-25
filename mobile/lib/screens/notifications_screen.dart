import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts & Notifications')),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final disruptions = provider.activeDisruptions;
          final lastExecution = provider.lastExecution;

          if (disruptions.isEmpty && lastExecution == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.notifications_none, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('No Notifications', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  const Text('You\'re all caught up!', style: TextStyle(color: AppColors.textSecondary)),
                ],
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (lastExecution != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.check_circle, color: AppColors.successGreen),
                    title: const Text('Recovery Executed'),
                    subtitle: Text('Status: ${lastExecution.status}'),
                  ),
                ),
              ...disruptions.map((disruption) => Card(
                child: ListTile(
                  leading: const Icon(Icons.warning, color: AppColors.alertRed),
                  title: Text(disruption.disruptionType),
                  subtitle: Text(disruption.description),
                ),
              )),
            ],
          );
        },
      ),
    );
  }
}
