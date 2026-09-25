import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../widgets/travora_card.dart';

class ImpactScreen extends StatelessWidget {
  const ImpactScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Journey Impact', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          if (provider.state == ProviderState.loading) {
            return Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary));
          }
          if (provider.state == ProviderState.error) {
            return Center(child: Text(provider.errorMessage ?? 'Something went wrong', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))));
          }

          final impact = provider.impactResult;
          if (impact == null) {
            return Center(child: Text('No impact analysis available.'));
          }

          return ListView(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            children: [
              Text('WHAT CHANGED?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.all(20),
                border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.warning_amber, color: const Color(0xFFF59E0B), size: 24),
                        SizedBox(width: 12),
                        Expanded(child: Text('Disruption Confirmed', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : Color(0xFF1E293B))))),
                        Container(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: const Color(0xFFF59E0B).withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
                          child: Text('AFFECTED', style: TextStyle(color: const Color(0xFFF59E0B), fontWeight: FontWeight.bold, fontSize: 10)),
                        ),
                      ],
                    ),
                    SizedBox(height: 16),
                    Text(impact.affectedItems.isNotEmpty ? 'Missed connection risk detected' : 'Schedule delay detected', style: Theme.of(context).textTheme.bodyLarge),
                  ],
                ),
              ),
              SizedBox(height: 32),
              
              Text('WHAT THIS AFFECTS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (impact.affectedItems.isEmpty)
                      Text('Your onward journey is not severely affected.', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
                      
                    ...impact.affectedItems.map((item) => Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.circle, size: 8, color: item.impactType.contains('CANCEL') ? const Color(0xFFDC2626) : const Color(0xFFF59E0B)),
                          SizedBox(width: 12),
                          Expanded(child: Text(item.description.isNotEmpty ? item.description : 'Impact on itinerary item ${item.itemId}', style: TextStyle(fontWeight: FontWeight.w600, color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B))))),
                        ],
                      ),
                    )),
                  ],
                ),
              ),
              
              SizedBox(height: 40),
              Container(
                padding: EdgeInsets.all(20),
                decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(16)),
                child: Column(
                  children: [
                    Icon(Icons.auto_awesome, color: Theme.of(context).colorScheme.primary, size: 32),
                    SizedBox(height: 12),
                    Text('Travora has analyzed your journey.', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Theme.of(context).colorScheme.primary)),
                    SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: () {
                          if (provider.activeDisruptions.isNotEmpty) {
                            provider.fetchRecoveryOptions();
                            context.push('/recovery');
                          }
                        },
                        child: Text('View Recovery Options', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 48),
            ],
          );
        },
      ),
    );
  }
}
