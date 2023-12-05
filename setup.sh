#!/bin/sh

# This script sets up the development environment without installing Agama packages. This script is
# supposed to run within a repository clone.

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

# Services setup
if ! $MYDIR/setup-services.sh; then
  echo "Services setup failed."
  echo "Agama services are NOT running."

  exit 2
fi;

# Web setup
if ! $MYDIR/setup-web.sh; then
  echo "Web client setup failed."
  echo "Agama web client is NOT running."

  exit 3
fi;

# Start the installer.
echo
echo "D-Bus will start the services, see journalctl for their logs."
echo "To start the services manually, logging to the terminal:"
echo "  $SUDO systemctl start agama.service"
echo
echo "Visit http://localhost:9090/cockpit/@localhost/agama/index.html"
