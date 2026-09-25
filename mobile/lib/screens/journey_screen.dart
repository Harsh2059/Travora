import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../models/trip.dart';
import '../widgets/travora_card.dart';
import '../widgets/transport_icon.dart';
import '../widgets/status_badge.dart';

class JourneyScreen extends StatelessWidget {
  const JourneyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Journey', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final trip = provider.activeTrip;
          if (trip == null) {
            return Center(child: Text('No active journey.'));
          }

          final items = List<ItineraryItem>.from(trip.items)
            ..sort((a, b) => (a.startTime ?? DateTime.now()).compareTo(b.startTime ?? DateTime.now()));

          return RefreshIndicator(
            color: Theme.of(context).colorScheme.primary,
            onRefresh: () => provider.refreshActiveTrip(),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _buildHeader(context, trip, items),
                ),
                SliverPadding(
                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final item = items[index];
                        final isFirst = index == 0;
                        final isLast = index == items.length - 1;
                        return _buildTimelineItem(context, item, isFirst, isLast);
                      },
                      childCount: items.length,
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/add-item'),
        icon: Icon(Icons.add_location_alt),
        label: Text('Add to Journey'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildHeader(BuildContext context, Trip trip, List<ItineraryItem> items) {
    String route = trip.title;
    String dates = '';
    
    if (items.isNotEmpty) {
      final first = items.first;
      final last = items.last;
      
      if (first.origin != null && last.destination != null) {
        route = '${first.origin} → ${last.destination}';
      }
      if (first.startTime != null) {
        dates = DateFormat('dd MMM').format(first.startTime!);
        if (last.endTime != null || last.startTime != null) {
          final endDt = last.endTime ?? last.startTime;
          if (endDt != null) dates += ' — ${DateFormat('dd MMM').format(endDt)}';
        }
      }
    }

    return Container(
      padding: EdgeInsets.fromLTRB(24, 8, 24, 24),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(route, style: Theme.of(context).textTheme.headlineLarge),
          SizedBox(height: 8),
          Text(dates, style: TextStyle(fontSize: 16, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildTimelineItem(BuildContext context, ItineraryItem item, bool isFirst, bool isLast) {
    final timeStr = item.startTime != null ? DateFormat('hh:mm a').format(item.startTime!) : '--:--';
    
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline connector
          SizedBox(
            width: 60,
            child: Column(
              children: [
                Container(width: 2, height: 32, color: isFirst ? Colors.transparent : Colors.grey.shade300),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.grey.shade300, width: 2),
                  ),
                  child: Center(
                    child: TransportIcon(type: item.type, color: Theme.of(context).colorScheme.primary, size: 16),
                  ),
                ),
                Expanded(child: Container(width: 2, color: isLast ? Colors.transparent : Colors.grey.shade300)),
              ],
            ),
          ),
          
          // Card content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: 24, top: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(timeStr, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)))),
                      SizedBox(width: 12),
                      Container(width: 4, height: 4, decoration: BoxDecoration(color: Colors.grey, shape: BoxShape.circle)),
                      SizedBox(width: 12),
                      Text(item.type.toUpperCase(), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.0)),
                    ],
                  ),
                  SizedBox(height: 12),
                  TravoraCard(
                    padding: EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                item.provider.isNotEmpty ? item.provider : item.type,
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ),
                            StatusBadge(status: item.status),
                          ],
                        ),
                        SizedBox(height: 12),
                        
                        if (item.origin != null && item.destination != null)
                          Padding(
                            padding: EdgeInsets.only(bottom: 8),
                            child: Text('${item.origin} → ${item.destination}', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                          )
                        else if (item.location != null)
                          Padding(
                            padding: EdgeInsets.only(bottom: 8),
                            child: Text(item.location!, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.bold)),
                          ),
                        
                        if (item.bookingId != null && item.bookingId!.isNotEmpty)
                          Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Row(
                              children: [
                                Text('Booking Ref: ', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 13)),
                                Text(item.bookingId!, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              ],
                            ),
                          ),
                          
                        if (item.itemMetadata.isNotEmpty) ...[
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Divider(height: 1),
                          ),
                          ...item.itemMetadata.entries.map((entry) {
                            return Padding(
                              padding: EdgeInsets.only(bottom: 4),
                              child: Row(
                                children: [
                                  Text('${entry.key.replaceAll('_', ' ')}: ', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 13)),
                                  Text('${entry.value}', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                ],
                              ),
                            );
                          }),
                        ]
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

extension StringExtension on TextStyle {
  TextStyle get capitalize => copyWith(); // helper
}
