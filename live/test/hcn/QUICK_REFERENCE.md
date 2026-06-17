# HCN Manager Test Suite - Quick Reference

## One-Line Commands

```bash
# Run all tests
make test

# Run quick smoke tests (< 30 seconds)
make test-quick

# Run with verbose output
make test-verbose

# Run only unit tests
make test-unit

# Run only integration tests
make test-integration

# Run tests matching a pattern
make test-filter FILTER="parse_nm_connection"

# Debug a failing test
./run-tests.sh --trace --filter "test name"

# List all available tests
make list

# Clean temporary files
make clean

# Install BATS if not available
make install-bats
```

## Test Structure at a Glance

```
live/test/hcnmgr/
├── test_parse-hcnmgr.bats    # 35 unit tests
├── test_integration.bats     # 14 integration tests
├── run-tests.sh              # Test runner script
├── Makefile                  # Convenient make targets
├── README.md                 # Full documentation
├── TEST_SUMMARY.md           # This summary
├── QUICK_REFERENCE.md        # This file
│
├── Fixtures (test data):
├── proc/device-tree/         # Mock device-tree
├── sys/class/net/            # Mock sysfs
├── nm-initrd-generator-connections/  # Before fixup
├── hcnmgr-connections/        # After fixup (expected)
└── system-connections/       # Additional test data
```

## Test Categories

| Make Target | Description | Tests | Time |
|-------------|-------------|-------|------|
| `make test` | All tests | 49 | ~60s |
| `make test-quick` | Smoke tests | ~10 | <30s |
| `make test-unit` | Unit tests only | 35 | ~40s |
| `make test-integration` | Integration only | 14 | ~20s |
| `make test-helpers` | Helper functions | 11 | ~10s |
| `make test-fixup` | Connection fixup | 3 | ~5s |
| `make test-cmdline` | Cmdline generation | 6 | ~10s |

## Common Workflows

### Before Committing Changes

```bash
cd live/test/hcnmgr
make test-quick
```

### After Modifying parse-hcnmgr.sh

```bash
# Full test suite
make test-verbose

# Or with timing info
make test-timing
```

### Debugging a Test Failure

```bash
# 1. Run with trace
./run-tests.sh --trace --filter "failing test"

# 2. Inspect artifacts
ls -lh /tmp/hcnmgr-tests/test.*

# 3. Run just that test
bats test_parse-hcnmgr.bats --filter "exact test name"
```

### Adding a New Test

```bash
# 1. Edit the appropriate .bats file
vim test_parse-hcnmgr.bats  # or test_integration.bats

# 2. Add your test
@test "description" {
    # test code
}

# 3. Run to verify
make test-filter FILTER="description"

# 4. Run full suite
make test
```

## Test Output Codes

| Symbol | Meaning |
|--------|---------|
| ✓ | Test passed |
| ✗ | Test failed |
| - | Test skipped |

## Fixture Reference

### Bond 333e80f5 (Primary Test Fixture)

```
HCN ID: 333e80f5
Devices:
  - enP32775p1s0 (PCI, primary)   MAC: 2e:7a:30:83:f5:00
  - env6 (VNIC, backup)           MAC: 2e:7a:32:2d:3d:06

Expected bond configuration:
bond=bond333e80f5:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0

Connection transformation:
  Before: enP32775p1s0.nmconnection (controller=UUID)
  After:  bond333e80f5-enP32775p1s0.nmconnection (controller=bond333e80f5)
```

### Bond 5558a5a3 (Secondary Test Fixture)

```
HCN ID: 5558a5a3
Devices:
  - enP16386p1s0 (primary)
  - env7 (backup)

Used for: Multiple bond testing
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `parse-hcnmgr.sh` | The script being tested |
| `parse-hcnmgr-improvements.md` | Refactoring documentation |
| `test_parse-hcnmgr.bats` | Unit tests |
| `test_integration.bats` | End-to-end tests |
| `README.md` | Full documentation |

## Environment Variables

```bash
# Enable bash tracing
BATS_TRACE=1 bats test_parse-hcnmgr.bats

# Custom temp directory
BATS_TMPDIR=/custom/path bats test_parse-hcnmgr.bats
```

## CI/CD Integration

### GitLab CI

```yaml
test:hcnmgr:
  stage: test
  script:
    - cd live/test/hcnmgr
    - make test-tap
```

### Pre-commit Hook

```bash
#!/bin/bash
cd live/test/hcnmgr && make test-quick
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `bats: command not found` | `make install-bats` or `zypper install bats` |
| Test failures after editing script | Run `./run-tests.sh --trace --verbose` |
| Slow test execution | Run `make test-quick` instead |
| Permission errors | Ensure `/tmp` is writable |
| Fixture not found | Check you're in the `live/test/hcnmgr` directory |

## Performance Notes

- **Quick tests**: Helper functions, basic parsing (~10 tests, <30s)
- **Full suite**: All 49 tests (~60s)
- **Parallel execution**: Not supported by BATS (tests run sequentially)
- **Temp cleanup**: Automatic (BATS cleans up after each test)

## Coverage Summary

```
✓ Device discovery from device-tree
✓ MAC address extraction and formatting
✓ Bond configuration generation
✓ Command-line argument generation (bond=, ip=, rd.route=)
✓ NetworkManager connection fixup
✓ UUID to bond name transformation
✓ Connection file renaming
✓ Interface and MAC address matching
✓ Multiple bond handling
✓ DHCP and static IP configurations
✓ Route configuration
✓ Edge cases and error conditions
✓ POSIX compliance
✓ Performance optimizations
```

## Getting Help

```bash
# Show all make targets
make help

# Show test runner options
./run-tests.sh --help

# List all tests
make list

# Read full documentation
less README.md

# Read refactoring notes
less ../../parse-hcnmgr-improvements.md
```

## Links

- Script: `../../live-root/usr/lib/dracut/modules.d/99hcnmgr/parse-hcnmgr.sh`
- Documentation: [README.md](README.md)
- Summary: [TEST_SUMMARY.md](TEST_SUMMARY.md)
- Improvements: [../../parse-hcnmgr-improvements.md](../../parse-hcnmgr-improvements.md)

---

**Last Updated**: 2026-06-03
**Test Suite Version**: 1.0
**Total Tests**: 49 (35 unit + 14 integration)
