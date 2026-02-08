#!/bin/bash

# QA Test Script for AI Insights API
# Tests the generate_insights endpoint with various scenarios

API_URL="http://localhost:8100"
TEST_EMAIL="elcukrodev@gmail.com"
INTERNAL_SECRET="jkQVI/KtMhr+nOUp4R6PXqoGZhqYaWPzSCzFsAvHC/0="

echo "========================================"
echo "QA Test: AI Insights API"
echo "========================================"
echo ""

# Test 1: Check if insights endpoint exists
echo "Test 1: Check insights endpoint availability"
echo "----------------------------------------"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "X-User-ID: $TEST_EMAIL" \
  -H "X-Internal-Secret: $INTERNAL_SECRET" \
  "$API_URL/users/$TEST_EMAIL/insights")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d')

if [ "$http_code" = "200" ]; then
    echo "✓ PASS: Insights endpoint returned 200"
    echo "Response preview (first 500 chars):"
    echo "$body" | head -c 500
    echo "..."
else
    echo "✗ FAIL: Expected 200, got $http_code"
    echo "Response: $body"
fi

echo ""
echo ""

# Test 2: Verify JSON structure
echo "Test 2: Verify JSON response structure"
echo "----------------------------------------"
if echo "$body" | jq -e '.insights' > /dev/null 2>&1; then
    echo "✓ PASS: Response contains 'insights' field"

    # Check for required categories
    categories=$(echo "$body" | jq -r '.insights.categories | keys[]' 2>/dev/null)
    required_categories=("budgeting" "debt_management" "savings" "tax_optimization" "financial_freedom")

    echo "Categories found:"
    for cat in $categories; do
        echo "  - $cat"
    done

    echo ""
    echo "Checking required categories:"
    for req_cat in "${required_categories[@]}"; do
        if echo "$categories" | grep -q "$req_cat"; then
            echo "  ✓ $req_cat present"
        else
            echo "  ✗ $req_cat MISSING"
        fi
    done
else
    echo "✗ FAIL: Response is not valid JSON or missing 'insights' field"
fi

echo ""
echo ""

# Test 3: Check insights structure per category
echo "Test 3: Verify insights structure within categories"
echo "----------------------------------------"
for category in budgeting debt_management savings tax_optimization financial_freedom; do
    has_insights=$(echo "$body" | jq -e ".insights.categories.$category | length > 0" 2>/dev/null)
    if [ "$has_insights" = "true" ]; then
        count=$(echo "$body" | jq ".insights.categories.$category | length" 2>/dev/null)
        echo "✓ $category: $count insights"

        # Check first insight structure
        first_insight=$(echo "$body" | jq ".insights.categories.$category[0]" 2>/dev/null)
        has_title=$(echo "$first_insight" | jq -e '.title' > /dev/null 2>&1 && echo "yes" || echo "no")
        has_description=$(echo "$first_insight" | jq -e '.description' > /dev/null 2>&1 && echo "yes" || echo "no")
        has_priority=$(echo "$first_insight" | jq -e '.priority' > /dev/null 2>&1 && echo "yes" || echo "no")

        echo "  - title: $has_title, description: $has_description, priority: $has_priority"
    else
        echo "  $category: 0 insights (or error reading)"
    fi
done

echo ""
echo ""

# Test 4: Check for debt-related insights (testing AC2: debt snowball)
echo "Test 4: Debt Management Insights (Snowball Enforcement)"
echo "----------------------------------------"
debt_insights=$(echo "$body" | jq -r '.insights.categories.debt_management[]? | .description' 2>/dev/null)
if [ -n "$debt_insights" ]; then
    echo "Debt insights found. Checking for snowball methodology..."

    if echo "$debt_insights" | grep -iq "smallest"; then
        echo "✓ PASS: Mentions 'smallest' (snowball method indicator)"
    else
        echo "⚠ WARNING: No mention of 'smallest' balance"
    fi

    if echo "$debt_insights" | grep -iq "avalanche"; then
        echo "✗ FAIL: Mentions 'avalanche' (should only use snowball)"
    else
        echo "✓ PASS: No mention of 'avalanche' method"
    fi

    echo ""
    echo "Debt insight preview:"
    echo "$debt_insights" | head -n 3
else
    echo "ℹ INFO: No debt insights (user may have no debts)"
fi

echo ""
echo ""

# Test 5: Check for missing data links (AC5)
echo "Test 5: Missing Data Links in Action Items"
echo "----------------------------------------"
action_items=$(echo "$body" | jq -r '.insights.categories | to_entries[] | .value[] | .actionItems[]?' 2>/dev/null)

if [ -n "$action_items" ]; then
    echo "Action items found. Checking for markdown links..."

    link_count=$(echo "$action_items" | grep -o '\[.*\](/.*)' | wc -l | tr -d ' ')

    if [ "$link_count" -gt 0 ]; then
        echo "✓ PASS: Found $link_count markdown links in actionItems"
        echo ""
        echo "Sample links:"
        echo "$action_items" | grep '\[.*\](/.*)' | head -n 3
    else
        echo "⚠ WARNING: No markdown links found in actionItems"
    fi
else
    echo "ℹ INFO: No action items with links found"
fi

echo ""
echo ""

# Test 6: Check metadata and status
echo "Test 6: Response Metadata"
echo "----------------------------------------"
generated_at=$(echo "$body" | jq -r '.insights.generatedAt' 2>/dev/null)
current_step=$(echo "$body" | jq -r '.insights.currentBabyStep' 2>/dev/null)
fire_number=$(echo "$body" | jq -r '.insights.fireNumber' 2>/dev/null)

echo "generatedAt: ${generated_at:-'N/A'}"
echo "currentBabyStep: ${current_step:-'N/A'}"
echo "fireNumber: ${fire_number:-'N/A'}"

echo ""
echo ""

# Test 7: Check for status per category
echo "Test 7: Status Indicators per Category"
echo "----------------------------------------"
for category in budgeting debt_management savings tax_optimization financial_freedom; do
    status=$(echo "$body" | jq -r ".insights.status.$category" 2>/dev/null)
    echo "$category: ${status:-'N/A'}"
done

echo ""
echo ""

echo "========================================"
echo "QA Test Complete"
echo "========================================"
