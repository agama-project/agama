#!/bin/sh

# This script sets up the development environment without installing any
# package. This script is supposed to run within a repository clone.

# Exit on error; unset variables are an error
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

# Backend setup

if ! $MYDIR/setup-service.sh; then
  echo "Backend setup failed."
  echo "Agama service is NOT running."

  exit 2
fi;

# Install Frontend dependencies

$SUDO zypper --non-interactive --gpg-auto-import-keys install \
  make git 'npm>=18' cockpit

# Web Frontend

$SUDO systemctl start cockpit

# set up the web UI
cd web; make devel-install; cd -
$SUDO ln -snf `pwd`/web/dist /usr/share/cockpit/agama

# Start the installer
echo
echo "D-Bus will start the services, see journalctl for their logs."
echo "To start the services manually, logging to the terminal:"
echo "  $SUDO systemctl start agama.service"
echo
echo "Visit http://localhost:9090/cockpit/@localhost/agama/index.html"
