import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../models/recovery_option.dart';

class RecoveryOptionsScreen extends StatelessWidget {
  const RecoveryOptionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Recover Your Journey', style: TextStyle(fontWeight: FontWeight.bold)),
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

          final options = provider.recoveryOptions;
          if (options.isEmpty) {
            return _buildEmptyState(context, provider);
          }

          return ListView(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            children: [
              Text('We found these alternatives for you.', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
              SizedBox(height: 24),
              ...options.asMap().entries.map((entry) {
                final index = entry.key;
                final option = entry.value;
                return _buildOptionCard(context, provider, option, index: index, isRecommended: index == 0);
              }),
              SizedBox(height: 16),
              Text('NEARBY ACCOMMODATIONS & LOUNGES', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 16),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                clipBehavior: Clip.none,
                child: Row(
                  children: [
                    _buildAccommodationCard(context, 'Plaza Premium Lounge', 'Terminal 3, Near Gate 12', '₹2,500 / 4 hrs', Icons.weekend),
                    SizedBox(width: 16),
                    _buildAccommodationCard(context, 'Holiday Inn Express', 'Airport Transit Hotel', '₹6,000 / night', Icons.hotel),
                    SizedBox(width: 16),
                    _buildAccommodationCard(context, 'Aerotel Transit Hotel', 'Terminal 3, Arrivals', '₹4,500 / 6 hrs', Icons.bed),
                  ],
                ),
              ),
              SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }
  
  Widget _buildEmptyState(BuildContext context, TripProvider provider) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: EdgeInsets.all(24),
            decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
            child: Icon(Icons.search_off, size: 64, color: Colors.grey),
          ),
          SizedBox(height: 32),
          Text('No feasible recovery found', style: Theme.of(context).textTheme.headlineLarge),
          SizedBox(height: 12),
          Text("We couldn't find a valid alternative for this journey.", textAlign: TextAlign.center, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
          SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => context.pop(),
            child: Text('Go Back'),
          ),
        ],
      ),
    );
  }

  Widget _buildOptionCard(BuildContext context, TripProvider provider, RecoveryOption option, {required int index, required bool isRecommended}) {
    return Container(
      margin: EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isRecommended ? Theme.of(context).colorScheme.primary : (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : Colors.grey.shade200), width: isRecommended ? 2 : 1),
        boxShadow: [
          BoxShadow(
            color: isRecommended ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isRecommended ? const Color(0xFFE6F4EA) : (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade800 : Colors.grey.shade100),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isRecommended ? 'Option ${index + 1} • Best Match' : 'Option ${index + 1} • Alternative',
                    style: TextStyle(
                      color: isRecommended ? const Color(0xFF137333) : (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade300 : const Color(0xFF1E293B)),
                      fontWeight: FontWeight.bold,
                      fontSize: 12
                    )
                  )
                ),
                Text(
                  option.cost > 0 ? '${option.currency} ${option.cost.toStringAsFixed(0)} additional' : 'Zero Surcharge',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: option.cost > 0 ? const Color(0xFFF59E0B) : const Color(0xFF10B981)),
                ),
              ],
            ),
            SizedBox(height: 16),
            
            Row(
              children: [
                Icon(Icons.flight, color: Theme.of(context).colorScheme.primary, size: 20),
                SizedBox(width: 8),
                Text(option.optionType, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Theme.of(context).textTheme.bodyLarge?.color)),
              ],
            ),
            SizedBox(height: 12),
            
            ...option.description.map((desc) => Padding(
              padding: EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: EdgeInsets.only(top: 4.0),
                    child: Icon(Icons.circle, size: 6, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B))),
                  ),
                  SizedBox(width: 12),
                  Expanded(child: Text(desc, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)), height: 1.4))),
                ],
              ),
            )),
            
            SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => _confirmRecovery(context, provider, option),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isRecommended ? Theme.of(context).colorScheme.primary : Colors.transparent,
                  foregroundColor: isRecommended ? Colors.white : Theme.of(context).colorScheme.primary,
                  side: isRecommended ? BorderSide.none : BorderSide(color: Theme.of(context).colorScheme.primary),
                  elevation: 0,
                ),
                child: Text(isRecommended ? 'Selected as Primary Option' : 'Select Option ${index + 1}', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            )
          ],
        ),
      ),
    );
  }

  void _confirmRecovery(BuildContext context, TripProvider provider, RecoveryOption option) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Confirm Recovery', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text(
          'You are about to book this alternative. The total additional cost will be ${option.currency} ${option.cost.toStringAsFixed(2)}.',
          style: TextStyle(height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx), 
            child: Text('Cancel', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (loadingCtx) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
                      SizedBox(height: 24),
                      Text('Updating your journey...', style: TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                )
              );
              
              final success = await provider.executeRecovery(option);
              if (context.mounted) Navigator.pop(context); // pop loading
              
              if (success && context.mounted) {
                context.push('/confirmed');
              } else if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(provider.errorMessage ?? 'Execution failed'), backgroundColor: const Color(0xFFDC2626)));
              }
            },
            child: Text('Confirm Recovery'),
          )
        ],
      ),
    );
  }

  Widget _buildAccommodationCard(BuildContext context, String title, String subtitle, String price, IconData icon) {
    return Container(
      width: 240,
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary, size: 28),
          SizedBox(height: 16),
          Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)))),
          SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 13)),
          SizedBox(height: 16),
          Text(price, style: TextStyle(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
        ],
      ),
    );
  }
}
