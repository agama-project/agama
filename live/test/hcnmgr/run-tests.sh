#!/bin/bash
# Test runner for parse-hcnmgr unit tests
# Usage: ./run-tests.sh [OPTIONS]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored message
print_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Check if bats is installed
check_bats() {
    if ! command -v bats &> /dev/null; then
        print_color "$RED" "ERROR: BATS is not installed"
        echo ""
        echo "Install BATS using one of these methods:"
        echo ""
        echo "  openSUSE/SUSE:"
        echo "    zypper install bats"
        echo ""
        echo "  Fedora/RHEL:"
        echo "    dnf install bats"
        echo ""
        echo "  Ubuntu/Debian:"
        echo "    apt-get install bats"
        echo ""
        echo "  From source:"
        echo "    git clone https://github.com/bats-core/bats-core.git"
        echo "    cd bats-core"
        echo "    ./install.sh /usr/local"
        echo ""
        exit 1
    fi
}

# Show usage
usage() {
    cat << EOF
HCN Manager Unit Test Runner

Usage: $0 [OPTIONS]

OPTIONS:
    -h, --help          Show this help message
    -v, --verbose       Enable verbose output
    -f, --filter PATTERN Run only tests matching PATTERN
    -t, --tap           Output in TAP format
    --timing            Show test timing information
    --trace             Enable bash tracing (debug mode)
    --list              List all available tests
    --validate-fixtures Validate test fixtures only
    --quick             Run quick smoke tests only

    --integration       Run integration tests only
    --unit              Run unit tests only (default: both)

EXAMPLES:
    # Run all tests
    $0

    # Run with verbose output
    $0 --verbose

    # Run only connection fixup tests
    $0 --filter "fixup_nm_connections"

    # Run only fixture validation
    $0 --validate-fixtures

    # Run integration tests only
    $0 --integration

    # Debug a specific test
    $0 --trace --filter "parse_nm_connection: parses bond"

EOF
    exit 0
}

# Parse command line arguments
BATS_OPTS=()
FILTER=""
TRACE=0
LIST_ONLY=0
VALIDATE_FIXTURES=0
QUICK=0
INTEGRATION_ONLY=0
UNIT_ONLY=0

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -v|--verbose)
            BATS_OPTS+=(--show-output-of-passing-tests)
            shift
            ;;
        -f|--filter)
            FILTER="$2"
            BATS_OPTS+=(--filter "$2")
            shift 2
            ;;
        -t|--tap)
            BATS_OPTS+=(--tap)
            shift
            ;;
        --timing)
            BATS_OPTS+=(--timing)
            shift
            ;;
        --trace)
            TRACE=1
            shift
            ;;
        --list)
            LIST_ONLY=1
            shift
            ;;
        --validate-fixtures)
            VALIDATE_FIXTURES=1
            shift
            ;;
        --quick)
            QUICK=1
            shift
            ;;
        --integration)
            INTEGRATION_ONLY=1
            shift
            ;;
        --unit)
            UNIT_ONLY=1
            shift
            ;;
        *)
            print_color "$RED" "Unknown option: $1"
            usage
            ;;
    esac
done

# Check dependencies
check_bats

# Validate script exists
PARSE_SCRIPT="../../live-root/usr/lib/dracut/modules.d/99hcnmgr/parse-hcnmgr.sh"
if [ ! -f "$PARSE_SCRIPT" ]; then
    print_color "$RED" "ERROR: parse-hcnmgr.sh not found at $PARSE_SCRIPT"
    exit 1
fi

# Determine which test files to run
TEST_FILES=()
if [ $INTEGRATION_ONLY -eq 1 ]; then
    TEST_FILES=("test_integration.bats")
elif [ $UNIT_ONLY -eq 1 ]; then
    TEST_FILES=("test_parse-hcnmgr.bats")
else
    TEST_FILES=("test_parse-hcnmgr.bats" "test_integration.bats")
fi

# List tests if requested
if [ $LIST_ONLY -eq 1 ]; then
    print_color "$GREEN" "Available tests:"
    for test_file in "${TEST_FILES[@]}"; do
        echo ""
        print_color "$YELLOW" "From $test_file:"
        grep -E "^@test" "$test_file" | sed 's/@test "\(.*\)" {/  - \1/'
    done
    exit 0
fi

# Validate fixtures if requested
if [ $VALIDATE_FIXTURES -eq 1 ]; then
    print_color "$YELLOW" "Validating test fixtures..."
    BATS_OPTS+=(--filter "fixture validation")
fi

# Quick smoke tests
if [ $QUICK -eq 1 ]; then
    print_color "$YELLOW" "Running quick smoke tests..."
    BATS_OPTS+=(--filter "xdump4|get_mac|parse_nm_connection.*bond")
fi

# Enable trace if requested
if [ $TRACE -eq 1 ]; then
    export BATS_TRACE=1
    print_color "$YELLOW" "Trace mode enabled"
fi

# Print test configuration
print_color "$GREEN" "================================"
print_color "$GREEN" "HCN Manager Unit Tests"
print_color "$GREEN" "================================"
echo ""
echo "Test files: ${TEST_FILES[*]}"
echo "Script:     $PARSE_SCRIPT"
[ -n "$FILTER" ] && echo "Filter:     $FILTER"
echo ""

# Run the tests
ALL_PASSED=1
for test_file in "${TEST_FILES[@]}"; do
    print_color "$YELLOW" "Running $test_file..."
    if ! bats "${BATS_OPTS[@]}" "$test_file"; then
        ALL_PASSED=0
    fi
done

if [ $ALL_PASSED -eq 1 ]; then
    print_color "$GREEN" ""
    print_color "$GREEN" "================================"
    print_color "$GREEN" "All tests passed! ✓"
    print_color "$GREEN" "================================"
    exit 0
else
    print_color "$RED" ""
    print_color "$RED" "================================"
    print_color "$RED" "Tests failed! ✗"
    print_color "$RED" "================================"
    echo ""
    print_color "$YELLOW" "Tips for debugging:"
    echo "  - Run with --verbose to see full output"
    echo "  - Run with --trace to enable bash tracing"
    echo "  - Run with --filter to test specific functions"
    echo "  - Check /tmp/hcnmgr-tests/ for test artifacts"
    echo ""
    exit $EXIT_CODE
fi
