import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: _buildBottomNav(context),
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    final String location = GoRouterState.of(context).uri.toString();
    int currentIndex = 0;
    if (location.startsWith('/trips')) {
      currentIndex = 1;
    } else if (location.startsWith('/alerts')) {
      currentIndex = 2;
    } else if (location.startsWith('/profile')) {
      currentIndex = 3;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.15),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary);
            }
            return TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)));
          }),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return IconThemeData(color: Theme.of(context).colorScheme.primary, size: 24);
            }
            return IconThemeData(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : Color(0xFF64748B)), size: 24);
          }),
        ),
        child: NavigationBar(
          selectedIndex: currentIndex,
          elevation: 0,
          height: 65,
          onDestinationSelected: (int index) {
            switch (index) {
              case 0:
                context.go('/');
                break;
              case 1:
                context.go('/trips');
                break;
              case 2:
                context.go('/alerts');
                break;
              case 3:
                context.go('/profile');
                break;
            }
          },
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.luggage_outlined), selectedIcon: Icon(Icons.luggage), label: 'Trips'),
            NavigationDestination(icon: Icon(Icons.notifications_none), selectedIcon: Icon(Icons.notifications), label: 'Alerts'),
            NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
