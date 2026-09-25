import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../models/trip.dart';
import '../core/theme/app_theme.dart';

class JourneyScreen extends StatelessWidget {
  const JourneyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Itinerary')),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final trip = provider.activeTrip;
          if (trip == null) {
            return const Center(child: Text('No active journey.'));
          }

          final items = trip.items..sort((a, b) => (a.startTime ?? DateTime.now()).compareTo(b.startTime ?? DateTime.now()));

          return RefreshIndicator(
            onRefresh: () => provider.refreshActiveTrip(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final isFirst = index == 0;
                final isLast = index == items.length - 1;
                return _buildTimelineItem(item, isFirst, isLast);
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/add-item'),
        icon: const Icon(Icons.add_location_alt),
        label: const Text('Add to Journey'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildTimelineItem(ItineraryItem item, bool isFirst, bool isLast) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(width: 2, height: 24, color: isFirst ? Colors.transparent : AppColors.primary.withValues(alpha: 0.3)),
                Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 4),
                  ),
                ),
                Expanded(child: Container(width: 2, color: isLast ? Colors.transparent : AppColors.primary.withValues(alpha: 0.3))),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: _buildTransportCard(item),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransportCard(ItineraryItem item) {
    IconData icon;
    if (item.type == 'FLIGHT') {
      icon = Icons.flight;
    } else if (item.type == 'TRAIN') {
      icon = Icons.train;
    } else if (item.type == 'CAB') {
      icon = Icons.local_taxi;
    } else if (item.type == 'HOTEL') {
      icon = Icons.hotel;
    } else {
      icon = Icons.directions_bus;
    }

    final String timeStr = item.startTime != null ? DateFormat('jm').format(item.startTime!) : '';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Text(timeStr, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Icon(icon, color: AppColors.primary),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(item.type, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                      Text(item.status, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (item.origin != null && item.destination != null) 
                    Text('${item.origin} → ${item.destination}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  if (item.location != null)
                    Text('Location: ${item.location}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  
                  const SizedBox(height: 8),
                  
                  // Provider / Airline / Operator
                  if (item.provider.isNotEmpty)
                    Text('Operator: ${item.provider}'),
                  
                  // PNR or Booking ID
                  if (item.bookingId != null)
                    Text('Booking Ref / PNR: ${item.bookingId}'),
                    
                  // Dynamic Metadata (Flight Number, Terminal, Coach, Seat, Driver)
                  ...item.itemMetadata.entries.map((entry) {
                    final key = entry.key.replaceAll('_', ' ').toUpperCase();
                    return Text('$key: ${entry.value}');
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
