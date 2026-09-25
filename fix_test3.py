import sys

with open('backend/tests/test_route_specific_flight_recovery.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
'''    # Since we added fallback flights, it will return OPTIONS_AVAILABLE with 2 fallback flights
    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) == 2
    assert len(result.plans) == 0''',
'''    # Since we added fallback flights, it will return OPTIONS_AVAILABLE with 2 fallback flights
    assert result.status == "OPTIONS_AVAILABLE"
    assert len(result.plans) == 2'''
)

with open('backend/tests/test_route_specific_flight_recovery.py', 'w', encoding='utf-8') as f:
    f.write(content)
