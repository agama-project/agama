#!/usr/bin/env bats

setup() {
  # Create a temporary directory for the generated file
  TMPDIR=$(mktemp -d)
  SCRIPT_PATH="$BATS_TEST_DIRNAME/../live-root/usr/bin/info-cmdline-conf.sh"
  FIXTURES_DIR="$BATS_TEST_DIRNAME/fixtures"
  # override the search path to mock the "agama" command
  PATH_ORIG="$PATH"
  PATH="$FIXTURES_DIR/bin:$PATH"
}

teardown() {
  # Clean up the temporary directory after the test
  rm -rf "$TMPDIR"
  PATH="$PATH_ORIG"
}

@test "does nothing when there is no info parameter" {
  TARGET_PATH="$TMPDIR/cmdline"
  INFO_PATH="$TMPDIR/cmdline.info"

  cp "$FIXTURES_DIR/source/cmdline" "$TARGET_PATH"

  run "$SCRIPT_PATH" "$TARGET_PATH" "$INFO_PATH"
  [ "$status" -eq 0 ]

  run diff -u "$FIXTURES_DIR/source/cmdline" "$TARGET_PATH"
  [ "$status" -eq 0 ]
  [ ! -e "$INFO_PATH" ]
}

@test "removes info parameter and adds its content" {
  TARGET_PATH="$TMPDIR/cmdline"
  INFO_PATH="$TMPDIR/cmdline.info"

  cp "$FIXTURES_DIR/source/info_cmdline" "$TARGET_PATH"

  run "$SCRIPT_PATH" "$TARGET_PATH" "$INFO_PATH"
  [ "$status" -eq 0 ]

  run diff -u "$FIXTURES_DIR/expected/info_cmdline" "$TARGET_PATH"
  [ "$status" -eq 0 ]

  run diff -u "$FIXTURES_DIR/expected/info_cmdline.info" "$INFO_PATH"
  [ "$status" -eq 0 ]
}
