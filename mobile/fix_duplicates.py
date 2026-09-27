with open('lib/providers/trip_provider.dart', 'r') as f:
    lines = f.readlines()

# Find the last occurrence of 'void _setState'
last_setstate = -1
for i, line in enumerate(lines):
    if 'void _setState' in line:
        last_setstate = i

if last_setstate >= 0:
    # Keep everything up to and including the _setState method and closing brace
    new_lines = lines[:last_setstate + 3]  # Include _setState method and closing brace
    with open('lib/providers/trip_provider.dart', 'w') as f:
        f.writelines(new_lines)
    print('Fixed duplicates')
else:
    print('Could not find _setState')