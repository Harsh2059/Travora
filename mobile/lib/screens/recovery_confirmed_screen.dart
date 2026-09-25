import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../widgets/travora_card.dart';

class RecoveryConfirmedScreen extends StatelessWidget {
  const RecoveryConfirmedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final exec = provider.lastExecution;
          
          return SafeArea(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(color: const Color(0xFF10B981).withValues(alpha: 0.1), shape: BoxShape.circle),
                    child: Icon(Icons.check_circle, size: 64, color: const Color(0xFF10B981)),
                  ),
                  SizedBox(height: 32),
                  Text('Journey Recovered', style: Theme.of(context).textTheme.displayMedium),
                  SizedBox(height: 16),
                  Text('Your itinerary has been updated successfully with the new arrangements.', textAlign: TextAlign.center, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
                  SizedBox(height: 48),
                  
                  TravoraCard(
                    padding: EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.airplane_ticket, color: Theme.of(context).colorScheme.primary),
                            SizedBox(width: 8),
                            Text('Booking Confirmed', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          ],
                        ),
                        SizedBox(height: 16),
                        const Divider(height: 1),
                        SizedBox(height: 16),
                        _buildDetailRow(context, 'Status', exec?.status ?? 'Success', isBold: true, color: const Color(0xFF10B981)),
                        SizedBox(height: 12),
                        _buildDetailRow(context, 'Additional Cost', 'None'), // Ideally from option, but we only have execution result
                      ],
                    ),
                  ),
                  
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        provider.refreshActiveTrip();
                        context.go('/'); // Go back to home to see updated journey
                      },
                      child: Text('View Updated Journey', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                  )
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value, {bool isBold = false, Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
        Text(value, style: TextStyle(fontWeight: isBold ? FontWeight.bold : FontWeight.w500, color: color ?? (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)))),
      ],
    );
  }
}
