import sys

with open('backend/tests/test_multi_disruption_sms.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
'''        # Must fail gracefully — not raise
        assert result.success is False''',
'''        # With the new fallback logic, this will succeed using the fallback number
        assert result.success is True
        assert result.recipient == "+917350571349"'''
)

with open('backend/tests/test_multi_disruption_sms.py', 'w', encoding='utf-8') as f:
    f.write(content)
