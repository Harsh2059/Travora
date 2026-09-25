import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';
import '../models/trip.dart';

class DisruptionScreen extends StatelessWidget {
  const DisruptionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Disruptions')),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final disruptions = provider.activeDisruptions;
          if (disruptions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle_outline, size: 64, color: AppColors.successGreen),
                  const SizedBox(height: 16),
                  const Text('All Clear', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  const Text('There are no active disruptions for your journey.', style: TextStyle(color: AppColors.textSecondary)),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: disruptions.length,
            itemBuilder: (context, index) {
              final disruption = disruptions[index];
              return Card(
                color: AppColors.alertBackground,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppColors.alertRed),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning, color: AppColors.alertRed),
                          const SizedBox(width: 8),
                          Expanded(child: Text(disruption.disruptionType.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.alertRed))),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(_formatDisruptionMessage(provider.activeTrip, disruption), style: const TextStyle(fontSize: 16)),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => context.push('/impact'),
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.textPrimary),
                          child: const Text('View Impact Analysis'),
                        ),
                      )
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  String _formatDisruptionMessage(Trip? trip, dynamic disruption) {
    if (trip == null) return disruption.description;
    
    try {
      final item = trip.items.firstWhere((i) => i.id == disruption.affectedItemId);
      final timeStr = item.startTime != null ? DateFormat('jm').format(item.startTime!) : 'its scheduled time';
      final typeStr = item.type.toLowerCase();
      
      String opStr = item.provider.isNotEmpty ? '${item.provider} ' : '';
      String locStr = (item.origin != null && item.destination != null) 
          ? 'from ${item.origin} to ${item.destination}' 
          : 'at ${item.location ?? 'unknown location'}';
          
      String actionStr = disruption.disruptionType.toLowerCase().contains('cancel') ? 'has been cancelled' : 'has been delayed/disrupted';
      
      return 'Your $opStr$typeStr $locStr scheduled for $timeStr $actionStr. Reason: ${disruption.description}';
    } catch (e) {
      return disruption.description;
    }
  }
}
