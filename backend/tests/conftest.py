import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app
from routers.auth import get_current_user
from models import User

def mock_get_current_user():
    return User(id=1, role="admin", name="Test Admin", email="admin@example.com")

@pytest.fixture(autouse=True)
def override_auth(request):
    if "test_auth.py" in request.node.fspath.strpath:
        yield
        return
    app.dependency_overrides[get_current_user] = mock_get_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
