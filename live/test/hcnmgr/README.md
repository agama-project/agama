# HCN Manager Unit Tests

This directory contains unit tests for the `parse-hcnmgr.sh` dracut module, along with test fixtures that simulate a real PowerPC HCN (Hybrid Cloud Network) environment.

## Test Structure

```
live/test/hcnmgr/
├── test_parse-hcnmgr.bats          # BATS test suite
├── proc/device-tree/                # Mock device-tree (simulates /proc/device-tree)
│   ├── pci@800000029008007/
│   │   └── ethernet@0/              # SR-IOV PCI device (primary)
│   │       ├── ibm,hcn-id           # HCN ID: 333e80f5
│   │       ├── ibm,hcn-mode         # Mode: primary
│   │       ├── local-mac-address    # MAC: 2e:7a:30:83:f5:00
│   │       └── ofpathname           # Maps to: enP32775p1s0
│   └── vdevice/
│       └── vnic@30000006/           # VNIC device (backup)
│           ├── ibm,hcn-id           # HCN ID: 333e80f5
│           ├── ibm,hcn-mode         # Mode: backup
│           ├── local-mac-address    # MAC: 2e:7a:32:2d:3d:06
│           └── ofpathname           # Maps to: env6
├── sys/class/net/                   # Mock sysfs network devices
│   ├── enP32775p1s0/                # Primary interface
│   └── env6/                        # Backup interface
├── nm-initrd-generator-connections/ # Connections created by nm-initrd-generator
│   ├── bond333e80f5.nmconnection    # Bond master
│   ├── enP32775p1s0.nmconnection    # Slave (controller=UUID)
│   └── env6.nmconnection            # Slave (controller=UUID)
├── hcnmg-connections/               # Expected connections after fixup
│   ├── bond333e80f5.nmconnection    # Bond master
│   ├── bond333e80f5-enP32775p1s0.nmconnection  # Slave (controller=bond name)
│   └── bond333e80f5-env6.nmconnection          # Slave (controller=bond name)
└── system-connections/              # Additional test connections (bond5558a5a3)
    ├── bond5558a5a3.nmconnection
    ├── enP16386p1s0.nmconnection
    └── env7.nmconnection
```

## Test Fixtures

### Bond Configuration: bond333e80f5

This fixture simulates the scenario from the original improvement document where `nm-initrd-generator` is called with:

```bash
/usr/libexec/nm-initrd-generator \
  bond=bond333e80f5:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0 \
  ip=10.2.2.69::10.2.0.1:255.255.255.0::bond333e80f5:off
```

#### Device Tree Information

| Device | Type | HCN ID | Mode | MAC | Interface |
|--------|------|--------|------|-----|-----------|
| pci@800000029008007/ethernet@0 | SR-IOV | 333e80f5 | primary | 2e:7a:30:83:f5:00 | enP32775p1s0 |
| vdevice/vnic@30000006 | VNIC | 333e80f5 | backup | 2e:7a:32:2d:3d:06 | env6 |

#### Connection Transformation

**Before fixup (nm-initrd-generator output):**
- `enP32775p1s0.nmconnection` has `controller=e2a7b4b8-8297-4185-8421-ed32cf47db1c` (UUID)
- `env6.nmconnection` has `controller=e2a7b4b8-8297-4185-8421-ed32cf47db1c` (UUID)

**After fixup (hcnmgr expected output):**
- `bond333e80f5-enP32775p1s0.nmconnection` has `controller=bond333e80f5` (bond name)
- `bond333e80f5-env6.nmconnection` has `controller=bond333e80f5` (bond name)

This transformation is critical because `hcnmgr` (the userspace tool) expects bond names, not UUIDs.

## Running the Tests

### Prerequisites

1. **Install BATS** (Bash Automated Testing System):
   ```bash
   # On openSUSE/SUSE
   zypper install bats

   # On Fedora/RHEL
   dnf install bats

   # On Ubuntu/Debian
   apt-get install bats

   # Or install from source
   git clone https://github.com/bats-core/bats-core.git
   cd bats-core
   ./install.sh /usr/local
   ```

2. **Required tools** (should be available on PowerPC test systems):
   - `hexdump`
   - `awk`
   - `sed`
   - `grep`

### Run All Tests

```bash
cd /home/suse/SUSE/Development/agama/live/test/hcnmgr
bats test_parse-hcnmgr.bats
```

### Run Specific Tests

```bash
# Run only fixture validation tests
bats test_parse-hcnmgr.bats --filter "fixture validation"

# Run only function tests
bats test_parse-hcnmgr.bats --filter "parse_nm_connection"

# Run only cmdline generation tests
bats test_parse-hcnmgr.bats --filter "cmdline generation"
```

### Verbose Output

```bash
# Show all test output
bats test_parse-hcnmgr.bats --tap

# Show detailed timing
bats test_parse-hcnmgr.bats --timing
```

## Test Coverage

### 1. Helper Functions (11 tests)

- ✅ `xdump4()` - Reading 4-byte HCN IDs from device-tree
- ✅ `get_mac()` - Extracting MAC addresses from device-tree
- ✅ `parse_nm_connection()` - Parsing NetworkManager connection files

### 2. Connection Fixup (3 tests)

- ✅ UUID-to-bond-name controller conversion
- ✅ Connection ID renaming (interface → bond-interface format)
- ✅ MAC address-based matching for connections without interface-name

### 3. Command Line Generation (6 tests)

- ✅ Bond argument creation from discovered devices
- ✅ `hcn.ip=dhcp` handling
- ✅ Static IP configuration with colon padding
- ✅ Slave interface replacement in `hcn.ip`
- ✅ Route configuration via `hcn.route`
- ✅ Slave interface replacement in `hcn.route`

### 4. Edge Cases (5 tests)

- ✅ Empty MAPPINGS (no HCN devices)
- ✅ Multiple bonds processed independently
- ✅ Case-insensitive MAC address matching
- ✅ Missing `ibm,hcn-mode` handling
- ✅ Graceful degradation

### 5. Performance & Code Quality (2 tests)

- ✅ Single awk invocation (vs 7+ sed calls in old implementation)
- ✅ POSIX compliance (`command -v` instead of `type`)

### 6. Fixture Validation (8 tests)

- ✅ Bond333e80f5 has two devices
- ✅ Device-to-interface mappings
- ✅ Primary/backup mode detection
- ✅ Connection file transformations

**Total: 35 tests**

## Test Scenarios Covered

### Scenario 1: Standard HCN Bond Setup
- Discovery of two devices (PCI + VNIC) with same HCN ID
- Primary device selection based on `ibm,hcn-mode`
- Bond creation with correct parameters
- NetworkManager connection fixup

### Scenario 2: DHCP Configuration
```bash
hcn.ip=dhcp
```
Expected result: `ip=bond333e80f5:dhcp`

### Scenario 3: Static IP Configuration
```bash
hcn.ip=10.2.2.69::10.2.0.1:255.255.255.0
```
Expected result: `ip=10.2.2.69::10.2.0.1:255.255.255.0::bond333e80f5:none`

### Scenario 4: Interface Replacement
```bash
hcn.ip=10.2.2.69::10.2.0.1:255.255.255.0::env6:off
```
Expected result: `ip=10.2.2.69::10.2.0.1:255.255.255.0::bond333e80f5:off`

### Scenario 5: Route Configuration
```bash
hcn.route=192.168.1.0/24:10.2.0.1
```
Expected result: `rd.route=192.168.1.0/24:10.2.0.1:bond333e80f5`

### Scenario 6: Multiple Bonds
- Independent processing of bond333e80f5 and bond5558a5a3
- No interference between bonds
- Correct slave assignment

## Performance Improvements Validated

The test suite validates the performance improvements documented in `parse-hcnmgr-improvements.md`:

1. **Connection File Parsing**: 7+ subprocess calls → 1 awk invocation
2. **I/O Reduction**: Single file read per connection instead of 7+
3. **Memory Efficiency**: Reduced subprocess spawning in initrd environment

## Debugging Failed Tests

### Enable Verbose Output
```bash
# Run with bash -x tracing
BATS_TRACE=1 bats test_parse-hcnmgr.bats
```

### Inspect Test Work Directory
Tests create temporary directories under `/tmp/hcnmgr-tests/`. On failure, you can inspect these:

```bash
# Find recent test directories
ls -lth /tmp/hcnmgr-tests/test.*

# Inspect created connections
cat /tmp/hcnmgr-tests/test.XXXXXX/run/NetworkManager/system-connections/*.nmconnection
```

### Common Issues

1. **"command not found: bats"** - Install BATS as described in Prerequisites

2. **Fixture file not found** - Ensure you're running from the correct directory:
   ```bash
   cd /home/suse/SUSE/Development/agama/live/test/hcnmgr
   ```

3. **Permission denied** - Some tests create temporary files; ensure `/tmp` is writable

## Extending the Tests

### Adding a New Test

```bash
@test "description of what is being tested" {
    # Setup
    load_script_functions  # If testing helper functions
    
    # Execute
    result=$(some_function "argument")
    
    # Assert
    [ "$result" = "expected_value" ]
}
```

### Adding a New Fixture

To test a different HCN configuration:

1. Create device-tree structure under `proc/device-tree/`
2. Add corresponding sysfs entries under `sys/class/net/`
3. Create expected connection files
4. Write test cases that use the new fixture

### Testing Against Real Hardware

On a PowerPC system with HCN support:

```bash
# Copy real device-tree data
cp -r /proc/device-tree/pci*/ethernet* ./proc/device-tree/
cp -r /proc/device-tree/vdevice/vnic* ./proc/device-tree/vdevice/

# Mock ofpathname results
for dev in ./proc/device-tree/*/ethernet* ./proc/device-tree/vdevice/vnic*; do
    ofpathname -l "${dev#./proc/device-tree}" > "$dev/ofpathname"
done

# Create corresponding sysfs structure
mkdir -p ./sys/class/net/
for iface in $(cat ./proc/device-tree/*/ofpathname); do
    mkdir -p "./sys/class/net/$iface"
done
```

## References

- [parse-hcnmgr-improvements.md](../../parse-hcnmgr-improvements.md) - Detailed refactoring documentation
- [BATS Documentation](https://bats-core.readthedocs.io/)
- [NetworkManager Connection Format](https://networkmanager.dev/docs/api/latest/nm-settings-keyfile.html)
- IBM PowerPC HCN Documentation

## Contributing

When modifying `parse-hcnmgr.sh`, please:

1. Update or add tests to cover your changes
2. Run the full test suite before submitting
3. Update this README if you add new test scenarios or fixtures
4. Ensure all tests pass on PowerPC hardware (if available)

## CI Integration

To integrate these tests into CI:

```bash
# In your .gitlab-ci.yml or similar
test:hcnmgr:
  stage: test
  script:
    - zypper install -y bats
    - cd live/test/hcnmgr
    - bats test_parse-hcnmgr.bats
  only:
    changes:
      - live/live-root/usr/lib/dracut/modules.d/99hcnmgr/**/*
```
