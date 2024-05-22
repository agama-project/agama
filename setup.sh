#!/bin/sh

# This script sets up the development environment without installing Agama
# packages. This script is supposed to run within a git repository clone.

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
echo "The configured Agama services can be manually started with these commands:"
echo
echo "  $SUDO systemctl start agama.service"
echo "  $SUDO systemctl start agama-web-server.service"
echo
echo "Visit http://localhost"
echo
echo "Note: If the firewall is running and you want to access the Agama installer"
echo "remotely then you need to open the firewall port with:"
echo
echo "  $SUDO firewall-cmd --zone=public --add-service=https"
