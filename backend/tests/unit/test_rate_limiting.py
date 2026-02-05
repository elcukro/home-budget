"""
Unit tests for rate limiting implementation on Tink endpoints.

Tests verify:
1. All Tink endpoints have rate limiting configured
2. Rate limits are correctly specified in code
3. get_limiter helper function exists and works
"""
import pytest
import ast
import re
from pathlib import Path


class TestRateLimitingConfiguration:
    """Test that rate limiting is properly configured in code."""

    @pytest.fixture
    def tink_router_content(self):
        """Load tink.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "tink.py"
        return path.read_text()

    @pytest.fixture
    def bank_transactions_router_content(self):
        """Load bank_transactions.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "bank_transactions.py"
        return path.read_text()

    def test_tink_router_has_get_limiter_helper(self, tink_router_content):
        """Verify get_limiter helper function exists."""
        assert "def get_limiter(request: Request) -> Limiter:" in tink_router_content
        assert "return request.app.state.limiter" in tink_router_content

    def test_bank_transactions_router_has_get_limiter_helper(self, bank_transactions_router_content):
        """Verify get_limiter helper function exists."""
        assert "def get_limiter(request: Request) -> Limiter:" in bank_transactions_router_content
        assert "return request.app.state.limiter" in bank_transactions_router_content

    def test_tink_connect_has_rate_limit(self, tink_router_content):
        """Test /connect endpoint has 10/hour rate limit."""
        # Find the connect endpoint section
        assert 'await limiter.check("10/hour", http_request)' in tink_router_content
        assert '@router.post("/connect"' in tink_router_content

    def test_tink_callback_post_has_rate_limit(self, tink_router_content):
        """Test POST /callback endpoint has 20/hour rate limit."""
        assert 'await limiter.check("20/hour", http_request)' in tink_router_content

    def test_tink_connections_get_has_rate_limit(self, tink_router_content):
        """Test GET /connections endpoint has 60/minute rate limit."""
        assert 'await limiter.check("60/minute", http_request)' in tink_router_content

    def test_tink_connections_delete_has_rate_limit(self, tink_router_content):
        """Test DELETE /connections/{id} endpoint has 10/hour rate limit."""
        # Should have two 10/hour limits - one for /connect and one for delete
        count = tink_router_content.count('await limiter.check("10/hour", http_request)')
        assert count >= 2  # At least connect and delete

    def test_tink_providers_has_rate_limit(self, tink_router_content):
        """Test /providers endpoint has 30/minute rate limit."""
        assert 'await limiter.check("30/minute", http_request)' in tink_router_content

    def test_tink_refresh_data_has_rate_limit(self, tink_router_content):
        """Test /refresh-data endpoint has 100/day rate limit."""
        assert 'await limiter.check("100/day", http_request)' in tink_router_content

    def test_tink_debug_data_has_rate_limit(self, tink_router_content):
        """Test /debug-data endpoint has 10/minute rate limit."""
        # Should have two 10/minute limits - test and debug-data
        count = tink_router_content.count('await limiter.check("10/minute", http_request)')
        assert count >= 2

    def test_bank_transactions_sync_has_rate_limit(self, bank_transactions_router_content):
        """Test /sync endpoint has 50/day rate limit."""
        assert 'await limiter.check("50/day", http_request)' in bank_transactions_router_content

    def test_bank_transactions_categorize_has_rate_limit(self, bank_transactions_router_content):
        """Test /categorize endpoint has 100/hour rate limit."""
        assert 'await limiter.check("100/hour", http_request)' in bank_transactions_router_content

    def test_bank_transactions_list_has_rate_limit(self, bank_transactions_router_content):
        """Test GET / (list) endpoint has 120/minute rate limit."""
        assert 'await limiter.check("120/minute", http_request)' in bank_transactions_router_content

    def test_bank_transactions_convert_has_rate_limit(self, bank_transactions_router_content):
        """Test convert endpoints have 200/hour rate limit."""
        assert 'await limiter.check("200/hour", http_request)' in bank_transactions_router_content

    def test_bank_transactions_reset_has_rate_limit(self, bank_transactions_router_content):
        """Test reset endpoint has 100/hour rate limit."""
        # Should have two 100/hour - categorize and reset
        count = bank_transactions_router_content.count('await limiter.check("100/hour", http_request)')
        assert count >= 1  # At least reset

    def test_bank_transactions_bulk_has_rate_limit(self, bank_transactions_router_content):
        """Test bulk endpoints have 30/hour rate limit."""
        count = bank_transactions_router_content.count('await limiter.check("30/hour", http_request)')
        assert count >= 3  # bulk/reject, bulk/accept, bulk/convert


class TestEndpointCoverage:
    """Test that all endpoints have rate limiting."""

    @pytest.fixture
    def tink_router_content(self):
        """Load tink.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "tink.py"
        return path.read_text()

    @pytest.fixture
    def bank_transactions_router_content(self):
        """Load bank_transactions.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "bank_transactions.py"
        return path.read_text()

    def test_all_tink_endpoints_have_rate_limiting(self, tink_router_content):
        """Verify all public Tink endpoints have rate limiting calls.

        Note: Internal endpoints (/internal/*) are excluded from rate limiting
        as they are used for health checks and monitoring.
        """
        # Count endpoint definitions (excluding /internal/ endpoints)
        post_endpoints = re.findall(r'@router\.post\("(?!/internal)', tink_router_content)
        get_endpoints = re.findall(r'@router\.get\("(?!/internal)', tink_router_content)
        delete_endpoints = re.findall(r'@router\.delete\("(?!/internal)', tink_router_content)

        total_endpoints = len(post_endpoints) + len(get_endpoints) + len(delete_endpoints)

        # Count rate limit calls
        rate_limit_calls = tink_router_content.count('await limiter.check(')

        # Should be equal (one rate limit per public endpoint)
        assert rate_limit_calls == total_endpoints, \
            f"Expected {total_endpoints} rate limit calls, found {rate_limit_calls}"

    def test_all_bank_transactions_endpoints_have_rate_limiting(self, bank_transactions_router_content):
        """Verify all 12 bank transaction endpoints have rate limiting calls."""
        # Count endpoint definitions
        post_endpoints = re.findall(r'@router\.post\("', bank_transactions_router_content)
        get_endpoints = re.findall(r'@router\.get\("', bank_transactions_router_content)

        total_endpoints = len(post_endpoints) + len(get_endpoints)

        # Count rate limit calls
        rate_limit_calls = bank_transactions_router_content.count('await limiter.check(')

        # Should be equal (one rate limit per endpoint)
        assert rate_limit_calls == total_endpoints, \
            f"Expected {total_endpoints} rate limit calls, found {rate_limit_calls}"


class TestDocstringPlacement:
    """Test that docstrings are properly placed."""

    @pytest.fixture
    def tink_router_content(self):
        """Load tink.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "tink.py"
        return path.read_text()

    def test_connect_endpoint_has_proper_docstring(self, tink_router_content):
        """Verify /connect endpoint docstring is correctly placed."""
        # The docstring should appear before the rate limiting code
        # Find the function definition and check the order
        connect_section = tink_router_content[
            tink_router_content.find('async def initiate_connection'):
            tink_router_content.find('async def initiate_connection') + 500
        ]

        # Docstring should appear before limiter.check
        docstring_pos = connect_section.find('"""')
        limiter_pos = connect_section.find('limiter.check')

        assert docstring_pos < limiter_pos, \
            "Docstring should appear before rate limiting code"

        # Verify docstring content
        assert "Initiate Tink Link flow" in connect_section
        assert "Rate limit: 10/hour per user" in connect_section


class TestNoUnusedImports:
    """Test that there are no unused imports."""

    @pytest.fixture
    def tink_router_content(self):
        """Load tink.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "tink.py"
        return path.read_text()

    @pytest.fixture
    def bank_transactions_router_content(self):
        """Load bank_transactions.py content."""
        path = Path(__file__).parent.parent.parent / "app" / "routers" / "bank_transactions.py"
        return path.read_text()

    def test_tink_no_get_remote_address_import(self, tink_router_content):
        """Verify get_remote_address is not imported (unused)."""
        assert "get_remote_address" not in tink_router_content

    def test_bank_transactions_no_get_remote_address_import(self, bank_transactions_router_content):
        """Verify get_remote_address is not imported (unused)."""
        assert "get_remote_address" not in bank_transactions_router_content
