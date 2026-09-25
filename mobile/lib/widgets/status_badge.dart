import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color textColor;
    
    final s = status.toUpperCase();
    if (s == 'CONFIRMED' || s == 'ON TRACK') {
      bgColor = const Color(0xFF10B981).withValues(alpha: 0.15);
      textColor = const Color(0xFF10B981);
    } else if (s.contains('DELAY') || s.contains('DISRUPT')) {
      bgColor = const Color(0xFFF59E0B).withValues(alpha: 0.15);
      textColor = const Color(0xFFF59E0B);
    } else if (s.contains('CANCEL')) {
      bgColor = const Color(0xFFDC2626).withValues(alpha: 0.15);
      textColor = const Color(0xFFDC2626);
    } else {
      bgColor = Colors.grey.shade200;
      textColor = (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B));
    }

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: textColor,
          fontWeight: FontWeight.bold,
          fontSize: 10,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
