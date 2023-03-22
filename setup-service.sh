#!/bin/sh

# Using a git checkout in the current directory,
# set up the service (backend) part of d-installer
# so that it can be used by
# - the web frontend (as set up by setup.sh)
# - the CLI
# or both

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

# Helper:
# Like "sed -e $1 < $2 > $3" but $3 is a system file owned by root
sudosed() {
  echo "$2 -> $3"
  sed -e "$1" "$2" | $SUDO tee "$3" > /dev/null
}

# - Install the service dependencies
(
  cd $MYDIR/service
  bundle config set --local path 'vendor/bundle'
  bundle install
)

# - D-Bus configuration
$SUDO cp -v $MYDIR/service/share/dbus.conf /usr/share/dbus-1/d-installer.conf

# - D-Bus activation configuration
#   (this could be left out but then we would rely
#    on the manual startup via bin/d-installer)
(
  cd $MYDIR/service/share
  DBUSDIR=/usr/share/dbus-1/d-installer-services
  $SUDO mkdir -p $DBUSDIR
  for SVC in org.opensuse.DInstaller*.service; do
    sudosed "s@\(Exec\)=/usr/bin/@\1=$MYDIR/service/bin/@" $SVC $DBUSDIR/$SVC
  done
  sudosed "s@\(ExecStart\)=/usr/bin/@\1=$MYDIR/service/bin/@" \
          systemd.service /usr/lib/systemd/system/d-installer.service
  $SUDO systemctl daemon-reload
  # Start the separate dbus-daemon for D-Installer
  $SUDO systemctl start d-installer.service
)

# - Make sure NetworkManager is running
$SUDO systemctl start NetworkManager
