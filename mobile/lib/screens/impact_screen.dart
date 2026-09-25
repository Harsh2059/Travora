import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class ImpactScreen extends StatelessWidget {
  const ImpactScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Impact Analysis')),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final impact = provider.impactResult;
          if (impact == null) {
            return const Center(child: Text('No impact data available.'));
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text('⚠ Ripple Effects Detected', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.alertRed, fontSize: 20)),
              const SizedBox(height: 16),
              const Text('This disruption affects your downstream journey.', style: TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 24),
              ...impact.affectedItems.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.arrow_right, color: AppColors.warningOrange),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.impactType.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(item.description),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
              const SizedBox(height: 32),
              if (impact.recoveryNeeded)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      provider.fetchRecoveryOptions();
                      context.push('/recovery');
                    },
                    child: const Text('View Recovery Options'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
