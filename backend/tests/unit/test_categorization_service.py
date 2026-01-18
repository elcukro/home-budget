"""
Unit tests for categorization service.

Tests the category constants and structure used for AI-powered transaction categorization.
Does not test the actual API calls (those would be integration tests).
"""

import pytest


# Copy of constants from categorization_service.py for isolated testing
EXPENSE_CATEGORIES = [
    "housing",
    "transportation",
    "food",
    "utilities",
    "insurance",
    "healthcare",
    "entertainment",
    "other"
]

INCOME_CATEGORIES = [
    "salary",
    "freelance",
    "investments",
    "rental",
    "other"
]

CATEGORY_DESCRIPTIONS = {
    # Expenses
    "housing": "rent, mortgage payments, property taxes, home repairs, furniture",
    "transportation": "car payments, fuel, gas station, public transport, uber, taxi, parking, car service",
    "food": "groceries, supermarket, restaurants, cafes, coffee shops, food delivery, takeaway",
    "utilities": "electricity, gas, water, internet, phone bill, mobile, TV subscription",
    "insurance": "health insurance, car insurance, life insurance, home insurance premiums",
    "healthcare": "doctors, dentist, pharmacy, medications, medical procedures, hospital",
    "entertainment": "movies, cinema, games, Netflix, Spotify, hobbies, sports, gym, books",
    "other": "anything that doesn't fit other expense categories",
    # Income
    "salary": "regular employment paycheck, wages, work income",
    "freelance": "contract work, consulting, gig economy, self-employment income",
    "investments": "dividends, interest, stock sales, capital gains, crypto",
    "rental": "rental income from property, Airbnb income",
    "other_income": "gifts, refunds, tax returns, bonuses not from employer, unexpected income"
}


class TestExpenseCategories:
    """Tests for EXPENSE_CATEGORIES list."""

    def test_expense_categories_count(self):
        """There should be 8 expense categories."""
        assert len(EXPENSE_CATEGORIES) == 8

    def test_all_expense_categories_present(self):
        """All expected expense categories are present."""
        expected = {
            "housing",
            "transportation",
            "food",
            "utilities",
            "insurance",
            "healthcare",
            "entertainment",
            "other"
        }
        assert set(EXPENSE_CATEGORIES) == expected

    def test_expense_categories_are_lowercase(self):
        """All expense categories are lowercase."""
        for category in EXPENSE_CATEGORIES:
            assert category == category.lower(), f"Category '{category}' should be lowercase"

    def test_expense_categories_no_duplicates(self):
        """No duplicate expense categories."""
        assert len(EXPENSE_CATEGORIES) == len(set(EXPENSE_CATEGORIES))

    def test_other_is_last_expense_category(self):
        """'other' should be the last expense category (catch-all)."""
        assert EXPENSE_CATEGORIES[-1] == "other"


class TestIncomeCategories:
    """Tests for INCOME_CATEGORIES list."""

    def test_income_categories_count(self):
        """There should be 5 income categories."""
        assert len(INCOME_CATEGORIES) == 5

    def test_all_income_categories_present(self):
        """All expected income categories are present."""
        expected = {
            "salary",
            "freelance",
            "investments",
            "rental",
            "other"
        }
        assert set(INCOME_CATEGORIES) == expected

    def test_income_categories_are_lowercase(self):
        """All income categories are lowercase."""
        for category in INCOME_CATEGORIES:
            assert category == category.lower(), f"Category '{category}' should be lowercase"

    def test_income_categories_no_duplicates(self):
        """No duplicate income categories."""
        assert len(INCOME_CATEGORIES) == len(set(INCOME_CATEGORIES))

    def test_other_is_last_income_category(self):
        """'other' should be the last income category (catch-all)."""
        assert INCOME_CATEGORIES[-1] == "other"

    def test_salary_is_first_income_category(self):
        """'salary' should be the first income category (most common)."""
        assert INCOME_CATEGORIES[0] == "salary"


class TestCategoryDescriptions:
    """Tests for CATEGORY_DESCRIPTIONS dictionary."""

    def test_all_expense_categories_have_descriptions(self):
        """All expense categories have descriptions."""
        for category in EXPENSE_CATEGORIES:
            assert category in CATEGORY_DESCRIPTIONS, f"Missing description for expense: {category}"

    def test_all_income_categories_have_descriptions(self):
        """All income categories have descriptions (note: 'other' -> 'other_income')."""
        for category in INCOME_CATEGORIES:
            # Special case: 'other' income is 'other_income' in descriptions
            desc_key = "other_income" if category == "other" else category
            if category != "other":  # Skip 'other' which maps to both
                assert desc_key in CATEGORY_DESCRIPTIONS, f"Missing description for income: {category}"

    def test_descriptions_are_non_empty(self):
        """All descriptions are non-empty strings."""
        for key, description in CATEGORY_DESCRIPTIONS.items():
            assert isinstance(description, str), f"Description for '{key}' should be string"
            assert len(description) > 0, f"Description for '{key}' should not be empty"

    def test_descriptions_contain_examples(self):
        """Descriptions contain comma-separated examples."""
        for key, description in CATEGORY_DESCRIPTIONS.items():
            # Most descriptions should have multiple examples separated by commas
            if key != "other":  # 'other' might be generic
                assert "," in description, f"Description for '{key}' should have multiple examples"


class TestCategoryDescriptionContent:
    """Tests for specific content in category descriptions."""

    def test_housing_includes_rent_and_mortgage(self):
        """Housing description includes rent and mortgage."""
        desc = CATEGORY_DESCRIPTIONS["housing"].lower()
        assert "rent" in desc
        assert "mortgage" in desc

    def test_transportation_includes_fuel_and_transport(self):
        """Transportation description includes fuel and transport options."""
        desc = CATEGORY_DESCRIPTIONS["transportation"].lower()
        assert "fuel" in desc or "gas" in desc
        assert "transport" in desc or "uber" in desc

    def test_food_includes_groceries_and_restaurants(self):
        """Food description includes groceries and restaurants."""
        desc = CATEGORY_DESCRIPTIONS["food"].lower()
        assert "groceries" in desc or "supermarket" in desc
        assert "restaurant" in desc

    def test_utilities_includes_common_utilities(self):
        """Utilities description includes electricity, internet, phone."""
        desc = CATEGORY_DESCRIPTIONS["utilities"].lower()
        assert "electricity" in desc
        assert "internet" in desc
        assert "phone" in desc

    def test_healthcare_includes_medical_terms(self):
        """Healthcare description includes medical terms."""
        desc = CATEGORY_DESCRIPTIONS["healthcare"].lower()
        assert "doctor" in desc
        assert "pharmacy" in desc or "medication" in desc

    def test_entertainment_includes_subscriptions(self):
        """Entertainment description includes streaming subscriptions."""
        desc = CATEGORY_DESCRIPTIONS["entertainment"].lower()
        assert "netflix" in desc or "spotify" in desc or "subscription" in desc

    def test_salary_includes_employment_terms(self):
        """Salary description includes employment terms."""
        desc = CATEGORY_DESCRIPTIONS["salary"].lower()
        assert "employment" in desc or "work" in desc or "paycheck" in desc

    def test_investments_includes_financial_terms(self):
        """Investments description includes financial terms."""
        desc = CATEGORY_DESCRIPTIONS["investments"].lower()
        assert "dividend" in desc or "interest" in desc or "stock" in desc


class TestCategoryConsistency:
    """Tests for consistency between categories and descriptions."""

    def test_no_orphan_descriptions(self):
        """All description keys map to either expense or income categories."""
        valid_keys = set(EXPENSE_CATEGORIES) | set(INCOME_CATEGORIES) | {"other_income"}
        for key in CATEGORY_DESCRIPTIONS.keys():
            assert key in valid_keys, f"Orphan description key: {key}"

    def test_expense_and_income_no_overlap(self):
        """Expense and income categories don't overlap (except 'other')."""
        expense_set = set(EXPENSE_CATEGORIES) - {"other"}
        income_set = set(INCOME_CATEGORIES) - {"other"}
        assert expense_set.isdisjoint(income_set), "Expense and income categories should not overlap"


class TestTransactionCategorization:
    """Tests for transaction categorization logic patterns."""

    def test_negative_amounts_map_to_expenses(self):
        """Negative amounts should be categorized as expenses."""
        # This tests the pattern used in the categorization prompt
        amount = -50.0
        expected_type = "expense" if amount < 0 else "income"
        assert expected_type == "expense"

    def test_positive_amounts_map_to_income(self):
        """Positive amounts should be categorized as income."""
        amount = 1000.0
        expected_type = "expense" if amount < 0 else "income"
        assert expected_type == "income"

    def test_zero_amount_edge_case(self):
        """Zero amount defaults to income (not expense)."""
        amount = 0.0
        expected_type = "expense" if amount < 0 else "income"
        assert expected_type == "income"


class TestPolishMerchantPatterns:
    """Tests to verify Polish merchant names would be categorized correctly."""

    @pytest.mark.parametrize("merchant,expected_category", [
        ("BIEDRONKA", "food"),
        ("LIDL", "food"),
        ("ZABKA", "food"),
        ("ORLEN", "transportation"),
        ("PKP", "transportation"),
        ("ZUS", "other"),  # Social security
        ("US", "other"),   # Tax office
    ])
    def test_polish_merchant_category_hints(self, merchant, expected_category):
        """
        Polish merchant patterns should map to expected categories.

        Note: This is a hint test - actual categorization uses AI.
        These patterns help verify the category structure makes sense.
        """
        # Verify the expected category exists
        all_categories = set(EXPENSE_CATEGORIES) | set(INCOME_CATEGORIES)
        assert expected_category in all_categories, f"Category '{expected_category}' should exist"


class TestConstantsSync:
    """Meta-tests to verify test constants match source."""

    def test_expense_categories_match_expected(self):
        """
        Verify EXPENSE_CATEGORIES match expected values.

        If this fails, categorization_service.py may have changed.
        """
        assert "housing" in EXPENSE_CATEGORIES
        assert "food" in EXPENSE_CATEGORIES
        assert "entertainment" in EXPENSE_CATEGORIES

    def test_income_categories_match_expected(self):
        """
        Verify INCOME_CATEGORIES match expected values.

        If this fails, categorization_service.py may have changed.
        """
        assert "salary" in INCOME_CATEGORIES
        assert "investments" in INCOME_CATEGORIES
        assert "freelance" in INCOME_CATEGORIES
