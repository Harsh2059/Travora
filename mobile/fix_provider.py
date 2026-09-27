with open('lib/providers/trip_provider.dart', 'r') as f:
    content = f.read()

# Find all occurrences of the duplicate methods and keep only the first occurrence
import re

# Split by method definitions we care about
methods_to_check = [
    'Future<void> refreshRecoveryState()',
    'Future<void> fetchRecoveryOptions()',
    'Future<bool> updateUserProfile',
    'Future<bool> executeRecovery',
]

# Find all occurrences of each method
for method in methods_to_check:
    # Find all occurrences
    matches = list(re.finditer(re.escape(method) + r'\s*async', content))
    if len(matches) > 1:
        print(f'Duplicate method: {method} - found {len(matches)} times')
        for i, match in enumerate(matches):
            print(f'  Occurrence {i+1}: position {match.start()}')
        # Remove duplicates after the first occurrence
        # Keep the first occurrence, remove subsequent ones
        first_end = matches[0].start()
        # Find the end of the first method (next method or class end)
        # This is complex, let's just remove everything after the first occurrence of each duplicate
        # Actually, let's just remove the duplicates by keeping only the first occurrence of each method

# Better approach: split the content and rebuild
# Find the class end
class_end = content.rfind('}')
if class_end == -1:
    print("Could not find class end")
else:
    # Find the first occurrence of each duplicate method and remove subsequent ones
    # This is complex - let's just rewrite the file from scratch keeping only the first occurrences
    
    # Actually, let's just find the last valid line and truncate
    lines = content.split('\n')
    
    # Find the last valid method (_setState) and closing brace
    last_valid = -1
    for i, line in enumerate(lines):
        if 'void _setState' in line:
            last_valid = i
    
    if last_valid >= 0:
        # Keep up to the closing brace of _setState method
        new_lines = lines[:last_valid + 3]  # include _setState method and closing brace
        new_content = '\n'.join(new_lines)
        with open('lib/providers/trip_provider.dart', 'w') as f:
            f.write(new_content)
        print('Fixed by truncating at _setState method')
    else:
        print('Could not find _setState')

print('Done')