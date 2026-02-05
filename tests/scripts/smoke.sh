#!/bin/bash
# ==============================================================================
# Evolution API Add-on - Smoke Tests
# ==============================================================================
# Usage: ./smoke.sh [base_url] [api_key]
# Example: ./smoke.sh http://localhost:8080 my-api-key
# ==============================================================================

set -e

# Configuration
BASE_URL="${1:-http://localhost:8080}"
API_KEY="${2:-}"
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# ==============================================================================
# Helper Functions
# ==============================================================================

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

# Make HTTP request
# Usage: http_request METHOD ENDPOINT [DATA]
http_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    
    local curl_args=(
        -s
        -w "\n%{http_code}"
        -X "$method"
        --max-time "$TIMEOUT"
    )
    
    if [ -n "$API_KEY" ]; then
        curl_args+=(-H "apikey: $API_KEY")
    fi
    
    if [ -n "$data" ]; then
        curl_args+=(-H "Content-Type: application/json")
        curl_args+=(-d "$data")
    fi
    
    curl "${curl_args[@]}" "${BASE_URL}${endpoint}"
}

# Parse response and status code
# Usage: response=$(http_request ...); parse_response "$response"
parse_response() {
    local response="$1"
    local body=$(echo "$response" | sed '$d')
    local status=$(echo "$response" | tail -n 1)
    echo "$status|$body"
}

# ==============================================================================
# Test Cases
# ==============================================================================

test_server_running() {
    log_info "Testing: Server is running..."
    
    local response=$(http_request GET "/")
    local parsed=$(parse_response "$response")
    local status=$(echo "$parsed" | cut -d'|' -f1)
    
    if [ "$status" -ge 200 ] && [ "$status" -lt 500 ]; then
        log_pass "Server is running (HTTP $status)"
        return 0
    else
        log_fail "Server not responding (HTTP $status)"
        return 1
    fi
}

test_health_endpoint() {
    log_info "Testing: Health endpoint..."
    
    # Try common health check endpoints
    for endpoint in "/" "/health" "/api/health"; do
        local response=$(http_request GET "$endpoint")
        local parsed=$(parse_response "$response")
        local status=$(echo "$parsed" | cut -d'|' -f1)
        
        if [ "$status" = "200" ]; then
            log_pass "Health check passed at $endpoint"
            return 0
        fi
    done
    
    log_fail "No health endpoint responding with 200"
    return 1
}

test_api_authentication() {
    log_info "Testing: API authentication..."
    
    if [ -z "$API_KEY" ]; then
        log_info "Skipping auth test (no API key provided)"
        return 0
    fi
    
    local response=$(http_request GET "/instance/fetchInstances")
    local parsed=$(parse_response "$response")
    local status=$(echo "$parsed" | cut -d'|' -f1)
    
    if [ "$status" = "200" ] || [ "$status" = "401" ] || [ "$status" = "403" ]; then
        log_pass "API authentication endpoint responding (HTTP $status)"
        return 0
    else
        log_fail "API authentication test failed (HTTP $status)"
        return 1
    fi
}

test_instance_list() {
    log_info "Testing: Instance list endpoint..."
    
    local response=$(http_request GET "/instance/fetchInstances")
    local parsed=$(parse_response "$response")
    local status=$(echo "$parsed" | cut -d'|' -f1)
    local body=$(echo "$parsed" | cut -d'|' -f2-)
    
    if [ "$status" = "200" ]; then
        log_pass "Instance list retrieved successfully"
        return 0
    elif [ "$status" = "401" ]; then
        log_pass "Instance list requires authentication (expected)"
        return 0
    else
        log_fail "Instance list failed (HTTP $status)"
        return 1
    fi
}

test_create_instance() {
    log_info "Testing: Create instance endpoint..."
    
    local instance_name="smoke_test_$(date +%s)"
    local data='{"instanceName": "'"$instance_name"'", "qrcode": false}'
    
    local response=$(http_request POST "/instance/create" "$data")
    local parsed=$(parse_response "$response")
    local status=$(echo "$parsed" | cut -d'|' -f1)
    
    if [ "$status" = "200" ] || [ "$status" = "201" ]; then
        log_pass "Instance creation endpoint working"
        # Cleanup: delete the test instance
        http_request DELETE "/instance/delete/$instance_name" > /dev/null 2>&1 || true
        return 0
    elif [ "$status" = "401" ]; then
        log_pass "Instance creation requires authentication (expected)"
        return 0
    else
        log_fail "Instance creation failed (HTTP $status)"
        return 1
    fi
}

test_cors_headers() {
    log_info "Testing: CORS headers..."
    
    local response=$(curl -s -I -X OPTIONS \
        -H "Origin: http://localhost" \
        -H "Access-Control-Request-Method: POST" \
        --max-time "$TIMEOUT" \
        "${BASE_URL}/" 2>/dev/null)
    
    if echo "$response" | grep -qi "access-control"; then
        log_pass "CORS headers present"
        return 0
    else
        log_info "CORS headers not detected (may be okay)"
        return 0
    fi
}

test_websocket_endpoint() {
    log_info "Testing: WebSocket endpoint availability..."
    
    # Just check if the upgrade endpoint responds
    local response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Upgrade: websocket" \
        -H "Connection: Upgrade" \
        --max-time "$TIMEOUT" \
        "${BASE_URL}/ws" 2>/dev/null || echo "000")
    
    # WebSocket upgrade responses or 4xx are acceptable
    if [ "$response" != "000" ]; then
        log_pass "WebSocket endpoint reachable (HTTP $response)"
        return 0
    else
        log_info "WebSocket endpoint not tested (connection failed)"
        return 0
    fi
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    echo "============================================"
    echo "Evolution API Smoke Tests"
    echo "============================================"
    echo "Base URL: $BASE_URL"
    echo "API Key: ${API_KEY:+***configured***}${API_KEY:-not set}"
    echo "============================================"
    echo ""
    
    # Wait for server to be ready
    log_info "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s --max-time 2 "${BASE_URL}/" > /dev/null 2>&1; then
            break
        fi
        if [ $i -eq 30 ]; then
            log_fail "Server did not become ready in 30 seconds"
            exit 1
        fi
        sleep 1
    done
    echo ""
    
    # Run tests
    test_server_running || true
    test_health_endpoint || true
    test_api_authentication || true
    test_instance_list || true
    test_create_instance || true
    test_cors_headers || true
    test_websocket_endpoint || true
    
    # Summary
    echo ""
    echo "============================================"
    echo "Test Summary"
    echo "============================================"
    echo -e "Passed: ${GREEN}$PASSED${NC}"
    echo -e "Failed: ${RED}$FAILED${NC}"
    echo "============================================"
    
    if [ $FAILED -gt 0 ]; then
        exit 1
    fi
    exit 0
}

main "$@"
