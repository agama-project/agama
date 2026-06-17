# Makefile for parse-hcnmgr unit tests
# Provides convenient targets for running tests

.PHONY: all test test-verbose test-quick test-unit test-integration validate-fixtures clean help install-bats

# Default target
all: test

# Check if bats is installed
check-bats:
	@command -v bats >/dev/null 2>&1 || { \
		echo "ERROR: BATS is not installed"; \
		echo ""; \
		echo "Install with:"; \
		echo "  zypper install bats    # openSUSE/SUSE"; \
		echo "  dnf install bats       # Fedora/RHEL"; \
		echo "  apt-get install bats   # Ubuntu/Debian"; \
		exit 1; \
	}

# Run all tests
test: check-bats
	@echo "Running all tests..."
	@./run-tests.sh

# Run tests with verbose output
test-verbose: check-bats
	@echo "Running tests (verbose)..."
	@./run-tests.sh --verbose

# Run quick smoke tests only
test-quick: check-bats
	@echo "Running quick smoke tests..."
	@./run-tests.sh --quick

# Run unit tests only
test-unit: check-bats
	@echo "Running unit tests..."
	@./run-tests.sh --unit

# Run integration tests only
test-integration: check-bats
	@echo "Running integration tests..."
	@./run-tests.sh --integration

# Validate test fixtures only
validate-fixtures: check-bats
	@echo "Validating test fixtures..."
	@./run-tests.sh --validate-fixtures

# Run tests with TAP output (for CI)
test-tap: check-bats
	@./run-tests.sh --tap

# Run tests with timing information
test-timing: check-bats
	@./run-tests.sh --timing

# Run specific test by pattern
# Usage: make test-filter FILTER="parse_nm_connection"
test-filter: check-bats
	@if [ -z "$(FILTER)" ]; then \
		echo "Usage: make test-filter FILTER='pattern'"; \
		exit 1; \
	fi
	@./run-tests.sh --filter "$(FILTER)"

# Run tests with bash tracing (debug mode)
test-trace: check-bats
	@./run-tests.sh --trace --verbose

# List all available tests
list:
	@echo "Available tests:"
	@grep -E "^@test" test_parse-hcnmgr.bats | sed 's/@test "\(.*\)" {/  - \1/'

# Clean temporary test files
clean:
	@echo "Cleaning temporary test files..."
	@rm -rf /tmp/hcnmgr-tests/test.* 2>/dev/null || true
	@echo "Done."

# Install BATS from GitHub (if not available via package manager)
install-bats:
	@if command -v bats >/dev/null 2>&1; then \
		echo "BATS is already installed"; \
		bats --version; \
	else \
		echo "Installing BATS from GitHub..."; \
		git clone --depth 1 https://github.com/bats-core/bats-core.git /tmp/bats-core; \
		cd /tmp/bats-core && sudo ./install.sh /usr/local; \
		rm -rf /tmp/bats-core; \
		echo "BATS installed successfully"; \
		bats --version; \
	fi

# Show help
help:
	@echo "HCN Manager Unit Tests - Makefile targets"
	@echo ""
	@echo "Available targets:"
	@echo "  make test              - Run all tests (default)"
	@echo "  make test-verbose      - Run tests with verbose output"
	@echo "  make test-quick        - Run quick smoke tests only"
	@echo "  make test-unit         - Run unit tests only"
	@echo "  make test-integration  - Run integration tests only"
	@echo "  make test-tap          - Output in TAP format (for CI)"
	@echo "  make test-timing       - Show test timing information"
	@echo "  make test-trace        - Run with bash tracing (debug)"
	@echo "  make test-filter FILTER='pattern'"
	@echo "                         - Run tests matching pattern"
	@echo "  make validate-fixtures - Validate test fixtures only"
	@echo "  make list              - List all available tests"
	@echo "  make clean             - Clean temporary test files"
	@echo "  make install-bats      - Install BATS from GitHub"
	@echo "  make help              - Show this help message"
	@echo ""
	@echo "Examples:"
	@echo "  make test"
	@echo "  make test-verbose"
	@echo "  make test-filter FILTER='parse_nm_connection'"
	@echo "  make test-filter FILTER='cmdline generation'"
	@echo ""
	@echo "For more information, see README.md"

# Test categories
test-helpers: check-bats
	@./run-tests.sh --filter "xdump4|get_mac|parse_nm_connection"

test-fixup: check-bats
	@./run-tests.sh --filter "fixup_nm_connections"

test-cmdline: check-bats
	@./run-tests.sh --filter "cmdline generation"

test-edge-cases: check-bats
	@./run-tests.sh --filter "edge case"

test-performance: check-bats
	@./run-tests.sh --filter "performance"

test-posix: check-bats
	@./run-tests.sh --filter "POSIX compliance"

# CI integration target
ci: check-bats test-tap
	@echo "CI tests completed"

# Pre-commit hook target
pre-commit: test-quick
	@echo "Pre-commit tests passed"
