#! /bin/bash

# Check that all files checked by the shfmt tool are covered by the "paths"
# lists in the ci-shfmt.yml workflow, otherwise changing such a file would not
# trigger the CI check.
#
# Requires the "shfmt" and "yq" tools.

set -eu

# make sure the script runs in the repository root directory
cd "$(dirname "$0")/../.."

WORKFLOW=.github/workflows/ci-shfmt.yml

# the "push" and "pull_request" lists must be identical
if ! diff -u <(yq ".on.push.paths[]" $WORKFLOW) <(yq ".on.pull_request.paths[]" $WORKFLOW); then
  echo
  echo "::error file=$WORKFLOW::The 'push' and 'pull_request' paths lists differ!"
  exit 1
fi

# convert a path glob to an anchored extended regexp
glob_to_regex() {
  printf '%s' "$1" | sed \
    -e 's/[].+?^${}()|\\[]/\\&/g' \
    -e 's#\*\*/#\x01#g' -e 's#\*\*#\x02#g' -e 's#\*#[^/]*#g' \
    -e 's#\x01#(.*/)?#g' -e 's#\x02#.*#g' -e 's/^/^/' -e 's/$/$/'
}

# convert all GitHub Action globs to regexps, keep the "!" negation prefix
REGEXES=()
while IFS= read -r pattern; do
  if [[ $pattern == !* ]]; then
    REGEXES+=("!$(glob_to_regex "${pattern#!}")")
  else
    REGEXES+=("$(glob_to_regex "$pattern")")
  fi
done < <(yq ".on.push.paths[]" $WORKFLOW)

# the patterns are evaluated in order, the last matching one decides
is_covered() {
  local covered=1 regex
  for regex in "${REGEXES[@]}"; do
    if [[ $regex == !* ]]; then
      [[ $1 =~ ${regex#!} ]] && covered=1
    else
      [[ $1 =~ $regex ]] && covered=0
    fi
  done
  return $covered
}

# check that all files found by shfmt are covered by the "paths" list (ignore
# the generated live/dist files and the downloaded node modules when running in
# a local git checkout)
RESULT=0
while IFS= read -r file; do
  if ! is_covered "$file"; then
    echo "::error file=$WORKFLOW::File $file is not covered by the 'paths' list!"
    RESULT=1
  fi
done < <(shfmt -f . | grep -v -e "^live/dist/" -e "/node_modules/")

exit $RESULT
