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

# This displays the complete diff.
# Instead, I want just additions of whole files
git log ${REVISION1}...${REVISION2} -p --reverse