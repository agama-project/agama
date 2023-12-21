#!/bin/sh -x

# Exit on error; unset variables are an error.
set -eu

MYDIR=$(realpath $(dirname $0))

# Helper:
# Ensure root privileges for the installation.
# In a testing container, we are root but there is no sudo.
if [ $(id --user) != 0 ]; then
  SUDO=sudo
  if [ $($SUDO id --user) != 0 ]; then
    echo "We are not root and cannot sudo, cannot continue."
    exit 1
  fi
else
  SUDO=""
fi

$SUDO zypper --non-interactive --gpg-auto-import-keys install \
  make \
  'npm>=18' \
  cockpit || exit 1

$SUDO systemctl start cockpit

cd web; make devel-install; cd -
$SUDO ln -snf `pwd`/web/dist /usr/share/cockpit/agama
