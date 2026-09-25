import 'package:flutter/material.dart';

class TransportIcon extends StatelessWidget {
  final String type;
  final Color color;
  final double size;

  const TransportIcon({super.key, required this.type, this.color = Colors.black, this.size = 24});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    switch (type.toUpperCase()) {
      case 'FLIGHT':
        icon = Icons.flight;
        break;
      case 'TRAIN':
        icon = Icons.train;
        break;
      case 'CAB':
      case 'TRANSFER':
        icon = Icons.local_taxi;
        break;
      case 'HOTEL':
        icon = Icons.hotel;
        break;
      case 'EVENT':
        icon = Icons.calendar_today;
        break;
      case 'BUS':
      default:
        icon = Icons.directions_bus;
    }
    return Icon(icon, color: color, size: size);
  }
}
