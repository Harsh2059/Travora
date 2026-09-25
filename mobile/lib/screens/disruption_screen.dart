import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/trip_provider.dart';
import '../models/trip.dart';
import '../widgets/travora_card.dart';

class DisruptionScreen extends StatelessWidget {
  const DisruptionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Travel Alert', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final disruptions = provider.activeDisruptions;
          if (disruptions.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_outline, size: 64, color: const Color(0xFF10B981)),
                  SizedBox(height: 16),
                  Text('All Clear', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)))),
                  SizedBox(height: 8),
                  Text('There are no active disruptions for your journey.', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            itemCount: disruptions.length,
            itemBuilder: (context, index) {
              final disruption = disruptions[index];
              return Padding(
                padding: EdgeInsets.only(bottom: 24),
                child: TravoraCard(
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFDC2626), width: 2),
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF450a0a) : const Color(0xFFFEF2F2)),
                          borderRadius: BorderRadius.only(topLeft: Radius.circular(14), topRight: Radius.circular(14)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.warning, color: const Color(0xFFDC2626), size: 24),
                            SizedBox(width: 12),
                            Expanded(child: Text(disruption.disruptionType.replaceAll('_', ' ').toUpperCase(), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: const Color(0xFFDC2626), letterSpacing: 0.5))),
                          ],
                        ),
                      ),
                      Padding(
                        padding: EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_formatDisruptionMessage(provider.activeTrip, disruption), style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.5)),
                            SizedBox(height: 32),
                            SizedBox(
                              width: double.infinity,
                              height: 52,
                              child: ElevatedButton(
                                onPressed: () => context.push('/impact'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFDC2626),
                                  foregroundColor: Colors.white,
                                ),
                                child: Text('View Impact Analysis', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              ),
                            )
                          ],
                        ),
                      ),
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
    if (trip == null) {
      if (disruption.description.toString().toUpperCase().contains('UNKNOWN')) {
        return 'Something changed with your journey. We are analyzing the situation.';
      }
      return disruption.description;
    }
    
    try {
      final item = trip.items.firstWhere((i) => i.id == disruption.affectedItemId);
      final timeStr = item.startTime != null ? DateFormat('hh:mm a').format(item.startTime!) : 'its scheduled time';
      final typeStr = item.type.toLowerCase();
      
      String opStr = item.provider.isNotEmpty ? '${item.provider} ' : '';
      String locStr = (item.origin != null && item.destination != null) 
          ? 'from ${item.origin} to ${item.destination}' 
          : 'at ${item.location ?? 'unknown location'}';
          
      String actionStr = disruption.disruptionType.toLowerCase().contains('cancel') ? 'has been cancelled' : 'has been delayed/disrupted';
      
      return 'Your $opStr$typeStr $locStr scheduled for $timeStr $actionStr.\n\nReason: ${disruption.description}';
    } catch (e) {
      if (disruption.description.toString().toUpperCase().contains('UNKNOWN')) {
        return 'Something changed with your journey. We are analyzing the situation.';
      }
      return disruption.description;
    }
  }
}
