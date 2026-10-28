#!/usr/bin/env bats

setup() {
  # Create a temporary directory for the generated file
  TMPDIR=$(mktemp -d)
  SCRIPT_PATH="$BATS_TEST_DIRNAME/../live-root/usr/bin/kernel-cmdline-conf.sh"
  SOURCE_PATH="$BATS_TEST_DIRNAME/fixtures/source/cmdline"
  EXPECTED_PATH="$BATS_TEST_DIRNAME/fixtures/expected/cmdline"
}

teardown() {
  # Clean up the temporary directory after the test
  rm -rf "$TMPDIR"
}

@test "filters out any agama params" {
  TARGET_PATH="$TMPDIR/cmdline"

  run "$SCRIPT_PATH" "$SOURCE_PATH" "$TARGET_PATH"
  [ "$status" -eq 0 ]

  run diff -u "$EXPECTED_PATH" "$TARGET_PATH"
  [ "$status" -eq 0 ]
}
