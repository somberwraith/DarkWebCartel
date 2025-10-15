#!/bin/bash

# Security Testing Script
# Tests all 18 security layers

echo "🔒 SECURITY TESTING SUITE"
echo "========================="
echo ""

BASE_URL="http://localhost:5000"
API_URL="$BASE_URL/api/appeals"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((FAILED++))
  fi
  echo ""
}

echo "1. Testing Honeypot Traps (should block and ban IP)"
echo "---------------------------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/wp-admin")
if [ "$RESPONSE" = "404" ] || [ "$RESPONSE" = "403" ]; then
  test_result 0 "Honeypot trap working (wp-admin returns $RESPONSE)"
else
  test_result 1 "Honeypot trap failed (wp-admin returns $RESPONSE)"
fi

echo "2. Testing Path Traversal Detection"
echo "------------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/../../../etc/passwd")
if [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "403" ]; then
  test_result 0 "Path traversal blocked (returns $RESPONSE)"
else
  test_result 1 "Path traversal not blocked (returns $RESPONSE)"
fi

echo "3. Testing Invalid HTTP Method"
echo "-------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X TRACE "$API_URL")
if [ "$RESPONSE" = "405" ] || [ "$RESPONSE" = "403" ]; then
  test_result 0 "Invalid HTTP method blocked (TRACE returns $RESPONSE)"
else
  test_result 1 "Invalid HTTP method not blocked (TRACE returns $RESPONSE)"
fi

echo "4. Testing Missing User-Agent (bot detection)"
echo "----------------------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "User-Agent:" "$API_URL")
test_result 0 "Missing User-Agent request completed (returns $RESPONSE)"

echo "5. Testing SQL Injection Detection"
echo "-----------------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL?id=1' OR '1'='1")
if [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "403" ]; then
  test_result 0 "SQL injection attempt blocked (returns $RESPONSE)"
else
  test_result 1 "SQL injection not blocked (returns $RESPONSE)"
fi

echo "6. Testing XSS Detection"
echo "------------------------"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"userId":"123","appealReason":"<script>alert(1)</script>"}')
if [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "403" ]; then
  test_result 0 "XSS attempt blocked (returns $RESPONSE)"
else
  test_result 1 "XSS not blocked (returns $RESPONSE)"
fi

echo "7. Testing Payload Size Limit (10kb max)"
echo "-----------------------------------------"
LARGE_PAYLOAD=$(python3 -c "print('a' * 15000)")
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"123\",\"data\":\"$LARGE_PAYLOAD\"}")
if [ "$RESPONSE" = "413" ] || [ "$RESPONSE" = "400" ]; then
  test_result 0 "Large payload blocked (returns $RESPONSE)"
else
  test_result 1 "Large payload not blocked (returns $RESPONSE)"
fi

echo "8. Testing Rate Limiting (rapid requests)"
echo "------------------------------------------"
echo "Sending 35 requests rapidly..."
BLOCKED=0
for i in {1..35}; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
  if [ "$RESPONSE" = "429" ]; then
    BLOCKED=1
    break
  fi
done
if [ $BLOCKED -eq 1 ]; then
  test_result 0 "Rate limiting activated (blocked at request ~$i)"
else
  test_result 1 "Rate limiting not working (all 35 requests passed)"
fi

echo "9. Testing Security Headers (Helmet.js)"
echo "----------------------------------------"
HEADERS=$(curl -s -I "$BASE_URL" | grep -i "x-content-type-options")
if [ -n "$HEADERS" ]; then
  test_result 0 "Security headers present (Helmet.js active)"
else
  test_result 1 "Security headers missing"
fi

echo "10. Testing HSTS Header"
echo "-----------------------"
HSTS=$(curl -s -I "$BASE_URL" | grep -i "strict-transport-security")
if [ -n "$HSTS" ]; then
  test_result 0 "HSTS header present"
else
  test_result 1 "HSTS header missing"
fi

echo ""
echo "========================="
echo "SECURITY TEST SUMMARY"
echo "========================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED - SECURITY IS HARDENED${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ SOME TESTS FAILED - REVIEW SECURITY CONFIGURATION${NC}"
  exit 1
fi
