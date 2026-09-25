import os, re

def read(f):
    with open(f, 'r', encoding='utf-8') as file: return file.read()
def write(f, t):
    with open(f, 'w', encoding='utf-8') as file: file.write(t)

# 1. app_theme.dart
t = read('lib/core/theme/app_theme.dart')
t = t.replace('ThemeData get darkTheme {', '}\n  static ThemeData get darkTheme {')
write('lib/core/theme/app_theme.dart', t)

# 2. home_screen.dart
t = read('lib/screens/home_screen.dart')
t = t.replace('Widget _buildModeBadge(IconData icon, String label)', 'Widget _buildModeBadge(BuildContext context, IconData icon, String label)')
t = re.sub(r'_buildModeBadge\(([^,]+),\s*([^)]+)\)', r'_buildModeBadge(context, \1, \2)', t)
t = t.replace('Widget _buildEmptyState()', 'Widget _buildEmptyState(BuildContext context)')
t = t.replace('_buildEmptyState()', '_buildEmptyState(context)')
t = t.replace('Widget _buildEmptyState(BuildContext context)(BuildContext context)', 'Widget _buildEmptyState(BuildContext context)')
t = t.replace('_buildEmptyState(context)(context)', '_buildEmptyState(context)')
write('lib/screens/home_screen.dart', t)

# 3. my_trips_screen.dart
t = read('lib/screens/my_trips_screen.dart')
t = t.replace('Widget _buildEmptyState()', 'Widget _buildEmptyState(BuildContext context)')
t = t.replace('_buildEmptyState()', '_buildEmptyState(context)')
t = t.replace('Widget _buildEmptyState(BuildContext context)(BuildContext context)', 'Widget _buildEmptyState(BuildContext context)')
t = t.replace('_buildEmptyState(context)(context)', '_buildEmptyState(context)')
write('lib/screens/my_trips_screen.dart', t)

# 4. profile_screen.dart
t = read('lib/screens/profile_screen.dart')
if 'providers/theme_provider.dart' not in t:
    t = t.replace("import '../providers/trip_provider.dart';", "import '../providers/trip_provider.dart';\nimport '../providers/theme_provider.dart';")
write('lib/screens/profile_screen.dart', t)

# 5. impact_screen.dart
t = read('lib/screens/impact_screen.dart')
t = t.replace("const Expanded(child: Text('Disruption Confirmed'", "Expanded(child: Text('Disruption Confirmed'")
write('lib/screens/impact_screen.dart', t)

# 6. main_shell.dart
t = read('lib/screens/main_shell.dart')
t = t.replace('const IconThemeData(color: Theme', 'IconThemeData(color: Theme')
t = t.replace('const IconThemeData(color: (Theme', 'IconThemeData(color: (Theme')
write('lib/screens/main_shell.dart', t)

# 7. recovery_confirmed_screen.dart
t = read('lib/screens/recovery_confirmed_screen.dart')
t = t.replace('Widget _buildDetailRow(String label, String value', 'Widget _buildDetailRow(BuildContext context, String label, String value')
t = re.sub(r'_buildDetailRow\(([^,]+),\s*([^)]+)\)', r'_buildDetailRow(context, \1, \2)', t)
write('lib/screens/recovery_confirmed_screen.dart', t)

print('Fixed all issues!')
