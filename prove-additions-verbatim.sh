#!/bin/bash
# Given:
# - a git working copy in cwd
# - REVISION1
# - REVISION2
# - SOURCE_REPO
# - SOURCE_REVISION
# Prove that the file additions that happened here
# between REVISION1 and REVISION2
# are indeed verbatim copies of files from SOURCE_REPO
# at SOURCE_REVISION.

# Constraints:
# This is supposed to make reviow of a big PR easier.
# Therefore, this script must be easy to review.

# Complication: the source tree has a very different directory layout. We need
# to search by matching file name.

set -euo pipefail
export LANG=en_US.UTF-8

: ${REVISION1:=drop-yast-storage}
: ${REVISION2:=drop-yast2-incremental}
: ${SOURCE_REPO:=https://github.com/yast/yast-yast2}
: ${SOURCE_REVISION:=a393fc9e01135004cd692c09b63a66c6bea282cb}

DIR=/tmp/prove-additions-verbatim
mkdir -p $DIR
SRC=$DIR/source-repo

if [ ! -d $SRC ]; then
  cd $DIR
  git clone --quiet --depth=1 --revision ${SOURCE_REVISION} \
    ${SOURCE_REPO}.git source-repo
  cd - >/dev/null
fi

echo "Finding all files added between $REVISION1 and $REVISION2..."
# We use git diff with --diff-filter=A to get only the added files.
ADDED_FILES=$(git diff --diff-filter=A --name-only "$REVISION1" "$REVISION2")

if [ -z "$ADDED_FILES" ]; then
    echo "No files were added between $REVISION1 and $REVISION2."
    exit 0
fi

# Track if we found any failures
HAS_ERRORS=0

echo "Checking if added files are verbatim copies of files in the source repo..."

for FILE_PATH in $ADDED_FILES; do
    # Extract just the filename to search for it in the source repo
    FILE_NAME=$(basename "$FILE_PATH")

    # Find all files in the source repo that have this exact name (case-insensitive)
    # To handle directory components that were flattened into filename prefixes in the source repo
    # (e.g. `systemd/socket_finder_test.rb` -> `systemd_socket_finder_test.rb`),
    # we replace underscores in the filename with wildcards.
    # Additionally, some files like `ShadowConfig_test.rb` are mapped to `shadow_config_test.rb`,
    # so we convert CamelCase to snake_case first.
    SNAKE_CASE_NAME=$(echo "$FILE_NAME" | sed 's/\([a-z]\)\([A-Z]\)/\1_\2/g' | tr '[:upper:]' '[:lower:]')
    SEARCH_PATTERN="*"$(echo "$SNAKE_CASE_NAME" | tr '_' '*')
    MATCHING_SRC_FILES=$(find "$SRC" -type f -ipath "$SEARCH_PATTERN")

    if [ -z "$MATCHING_SRC_FILES" ]; then
        echo "❌ FAIL: '$FILE_PATH' was not found in the source repo by name ('$FILE_NAME')."
        HAS_ERRORS=1
        continue
    fi

    # Find the specific commit where this file was added
    ADD_COMMIT=$(git log --diff-filter=A --format=%H --reverse "${REVISION1}..${REVISION2}" -- "$FILE_PATH" | head -n 1)

    if [ -z "$ADD_COMMIT" ]; then
        echo "❌ FAIL: Could not find addition commit for '$FILE_PATH'."
        HAS_ERRORS=1
        continue
    fi

    MATCH_FOUND=0

    # Check each matching source file to see if its content is identical
    for SRC_FILE in $MATCHING_SRC_FILES; do
        # We compare the content of the file exactly as it was when added
        # against the source file using 'cmp'.
        if git show "${ADD_COMMIT}:${FILE_PATH}" | cmp -s - "$SRC_FILE"; then
            MATCH_FOUND=1
            echo "✅ OK: '$FILE_PATH' (at ${ADD_COMMIT:0:7}) matches verbatim with '$SRC_FILE'."
            break
        fi
    done

    if [ "$MATCH_FOUND" -eq 0 ]; then
        echo "❌ FAIL: '$FILE_PATH' (at ${ADD_COMMIT:0:7}) does not match any source files named '$FILE_NAME' verbatim."
        HAS_ERRORS=1
    fi
done

if [ "$HAS_ERRORS" -eq 1 ]; then
    echo ""
    echo "Summary: Some added files are NOT verbatim copies."
    exit 1
else
    echo ""
    echo "Summary: All added files are verbatim copies!"
    exit 0
fi
