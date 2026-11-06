#!/usr/bin/env bats

# Tests for the initrd-kernel-check dracut script.
#
# The script uses absolute paths (/etc/initrd-release, /run, /lib/modules), the
# tests redirect them to a temporary directory using environment variables.

KERNEL="6.4.0-test-default"

setup() {
  TEST_DIR=$(mktemp -d)
  export INITRD_ROOT="$TEST_DIR/initrd"
  export INITRD_RELEASE_FILE="$TEST_DIR/initrd/etc/initrd-release"
  export LOG_FILE="$TEST_DIR/run/initrd-kernel-check.log"
  ROOT="$TEST_DIR/sysroot"

  mkdir -p "$TEST_DIR/bin" "$TEST_DIR/run" "$TEST_DIR/initrd/etc" "$TEST_DIR/initrd/lib/modules" \
    "$ROOT/etc" "$ROOT/lib/modules"

  # fake the running kernel version
  printf '#!/bin/sh\necho "%s"\n' "$KERNEL" > "$TEST_DIR/bin/uname"
  chmod +x "$TEST_DIR/bin/uname"
  PATH="$TEST_DIR/bin:$PATH"

  SCRIPT="$BATS_TEST_DIRNAME/../live-root/usr/lib/dracut/modules.d/99initrd-kernel-check/initrd-kernel-check.sh"
}

teardown() {
  rm -rf "$TEST_DIR"
}

# helpers

# the initrd with the kernel modules directory
initrd_with_modules() {
  mkdir -p "$TEST_DIR/initrd/lib/modules/$KERNEL"
}

# the mounted root image with the kernel modules directory
root_with_modules() {
  mkdir -p "$ROOT/lib/modules/$KERNEL"
}

# $1 - ID, $2 - CPE_NAME
write_initrd_release() {
  printf 'ID="%s"\nCPE_NAME="%s"\n' "$1" "$2" > "$INITRD_RELEASE_FILE"
}

# $1 - ID, $2 - CPE_NAME
write_root_os_release() {
  printf 'ID="%s"\nCPE_NAME="%s"\n' "$1" "$2" > "$ROOT/etc/os-release"
}

# initrd check (no argument)

@test "initrd: succeeds when the modules for the running kernel exist" {
  initrd_with_modules

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"The initrd matches the kernel ($KERNEL)"* ]]
  [ ! -e "$LOG_FILE" ]
}

@test "initrd: fails when the modules for the running kernel are missing" {
  mkdir -p "$TEST_DIR/initrd/lib/modules/1.2.3-other"

  run "$SCRIPT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR: The initrd does not match the booted kernel!"* ]]
  [[ "$output" == *"The kernel version is \"$KERNEL\""* ]]
  # the available modules are listed
  [[ "$output" == *"1.2.3-other"* ]]
  [[ "$output" == *"Starting the emergency shell for debugging..."* ]]
}

@test "initrd: does not list the 'keys' directory in the available modules" {
  mkdir -p "$TEST_DIR/initrd/lib/modules/1.2.3-other" "$TEST_DIR/initrd/lib/modules/keys"

  run "$SCRIPT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"1.2.3-other"* ]]
  [[ "$output" != *"keys"* ]]
}

@test "initrd: does not check the os-release files" {
  initrd_with_modules
  # no /etc/initrd-release at all
  rm -f "$INITRD_RELEASE_FILE"

  run "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" != *"matches the initrd"* ]]
}

@test "initrd: saves the error to the log file" {
  run "$SCRIPT"

  [ "$status" -eq 1 ]
  [ -s "$LOG_FILE" ]
  grep -q "ERROR: The initrd does not match the booted kernel!" "$LOG_FILE"
  grep -q "This is a bug in the installation medium" "$LOG_FILE"
}

# root image check (the root directory argument)

@test "root image: succeeds when the kernel and the CPE_NAME match" {
  root_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  write_root_os_release sles "cpe:/o:suse:sles:16.1"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"The root image ($ROOT) matches the kernel ($KERNEL)"* ]]
  [[ "$output" == *"The root image ($ROOT) matches the initrd (CPE_NAME: \"cpe:/o:suse:sles:16.1\")"* ]]
  [ ! -e "$LOG_FILE" ]
}

@test "root image: fails when the modules for the running kernel are missing" {
  mkdir -p "$ROOT/lib/modules/1.2.3-other"
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  write_root_os_release sles "cpe:/o:suse:sles:16.1"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR: The root image ($ROOT) does not match the booted kernel!"* ]]
  [[ "$output" == *"1.2.3-other"* ]]
  # the product matches
  [[ "$output" == *"matches the initrd"* ]]
}

@test "root image: does not use the initrd modules directory" {
  # the modules are only in the initrd, not in the root image
  initrd_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  write_root_os_release sles "cpe:/o:suse:sles:16.1"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"does not match the booted kernel"* ]]
}

@test "root image: fails when the CPE_NAME differs" {
  root_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  write_root_os_release sles "cpe:/o:suse:sles:16.0"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR: The root image ($ROOT) does not match the initrd!"* ]]
  [[ "$output" == *"The CPE_NAME value is different"* ]]
  [[ "$output" == *"\"cpe:/o:suse:sles:16.1\""* ]]
  [[ "$output" == *"\"cpe:/o:suse:sles:16.0\""* ]]
}

@test "root image: fails when the root image has no os-release file" {
  root_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"does not match the initrd"* ]]
}

@test "root image: reports both the kernel and the product mismatch" {
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  write_root_os_release sles "cpe:/o:suse:sles:16.0"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"does not match the booted kernel"* ]]
  [[ "$output" == *"does not match the initrd"* ]]
  # both errors are saved in the log
  grep -q "does not match the booted kernel" "$LOG_FILE"
  grep -q "does not match the initrd" "$LOG_FILE"
}

@test "root image: the log file is appended, not overwritten" {
  echo "previous error" > "$LOG_FILE"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [ "$(head -n 1 "$LOG_FILE")" = "previous error" ]
  grep -q "does not match the booted kernel" "$LOG_FILE"
}

# os-release parsing

@test "os-release: supports single quoted, double quoted and unquoted values" {
  root_with_modules
  printf "ID=sles\nCPE_NAME=cpe:/o:suse:sles:16.1\n" > "$INITRD_RELEASE_FILE"
  printf "ID='sles'\nCPE_NAME='cpe:/o:suse:sles:16.1'\n" > "$ROOT/etc/os-release"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"(CPE_NAME: \"cpe:/o:suse:sles:16.1\")"* ]]
}

@test "os-release: uses the last value if the key is defined multiple times" {
  root_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  printf 'CPE_NAME="cpe:/o:suse:sles:15"\nCPE_NAME="cpe:/o:suse:sles:16.1"\n' > "$ROOT/etc/os-release"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 0 ]
}

@test "os-release: ignores keys which only end with the searched key name" {
  root_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  printf 'CPE_NAME="cpe:/o:suse:sles:16.1"\nFAKE_CPE_NAME="other"\nID_LIKE="other"\n' > "$ROOT/etc/os-release"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 0 ]
}

@test "os-release: does not execute any code from the file" {
  root_with_modules
  write_initrd_release sles "cpe:/o:suse:sles:16.1"
  printf 'CPE_NAME="$(touch %s/executed)"\n' "$TEST_DIR" > "$ROOT/etc/os-release"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [ ! -e "$TEST_DIR/executed" ]
}

# openSUSE Tumbleweed

@test "Tumbleweed: only the ID is compared, the CPE_NAME snapshot can differ" {
  root_with_modules
  write_initrd_release opensuse-tumbleweed "cpe:/o:opensuse:tumbleweed:20260101"
  write_root_os_release opensuse-tumbleweed "cpe:/o:opensuse:tumbleweed:20260202"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"matches the initrd (ID: \"opensuse-tumbleweed\")"* ]]
}

@test "Tumbleweed: fails when the root image has a different ID" {
  root_with_modules
  write_initrd_release opensuse-tumbleweed "cpe:/o:opensuse:tumbleweed:20260101"
  write_root_os_release sles "cpe:/o:suse:sles:16.1"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The ID value is different"* ]]
  [[ "$output" == *"\"opensuse-tumbleweed\""* ]]
  [[ "$output" == *"\"sles\""* ]]
}

@test "non-Tumbleweed: the CPE_NAME is compared even if the ID is the same" {
  root_with_modules
  write_initrd_release opensuse-leap "cpe:/o:opensuse:leap:16.0"
  write_root_os_release opensuse-leap "cpe:/o:opensuse:leap:16.1"

  run "$SCRIPT" "$ROOT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The CPE_NAME value is different"* ]]
}

