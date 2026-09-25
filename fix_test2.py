import sys

with open('backend/tests/test_route_specific_flight_recovery.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
'''    result = analyze_part4_recovery(journey, impact_result, known_unavailable=known_all_unavail)

    assert result.status == "NO_FEASIBLE_RECOVERY"''',
'''    result = analyze_part4_recovery(journey, impact_result, known_unavailable=known_all_unavail)

    # Since we added fallback flights, it will return OPTIONS_AVAILABLE with 2 fallback flights
    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) == 2'''
)

with open('backend/tests/test_route_specific_flight_recovery.py', 'w', encoding='utf-8') as f:
    f.write(content)
