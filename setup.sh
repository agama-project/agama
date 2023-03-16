#!/bin/sh

# This script sets up the development environment without installing any
# package. This script is supposed to run within a repository clone.

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

# Install dependencies

$SUDO zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel \
  'npm>=18' git augeas-devel cockpit jemalloc-devel || exit 1

# Helper:
# Like "sed -e $1 < $2 > $3" but $3 is a system file owned by root
sudosed() {
  echo "$2 -> $3"
  sed -e "$1" "$2" | $SUDO tee "$3" > /dev/null
}

MYDIR=$(realpath $(dirname $0))

# Backend setup

# - D-Bus configuration
$SUDO cp -v $MYDIR/service/share/dbus.conf /usr/share/dbus-1/d-installer.conf

# - D-Bus activation configuration
#   (this could be left out but then we would rely
#    on the manual startup via bin/d-installer)
(
  cd $MYDIR/service/share
  DBUSDIR=/usr/share/dbus-1/d-installer-services
  mkdir -p $DBUSDIR
  for SVC in org.opensuse.DInstaller*.service; do
    sudosed "s@\(Exec\)=/usr/bin/@\1=$MYDIR/service/bin/@" $SVC $DBUSDIR/$SVC
  done
  sudosed "s@\(ExecStart\)=/usr/bin/@\1=$MYDIR/service/bin/@" \
          systemd.service /usr/lib/systemd/system/d-installer.service
  $SUDO systemctl daemon-reload
)

# - Install the service dependencies
(
  cd $MYDIR/service
  bundle config set --local path 'vendor/bundle'
  bundle install
)


# Web Frontend

$SUDO systemctl start cockpit

# set up the web UI
cd web; make devel-install; cd -
$SUDO ln -snf `pwd`/web/dist /usr/share/cockpit/d-installer

# Start the installer
echo
echo "D-Bus will start the services, see journalctl for their logs."
echo "To start the services manually, logging to the terminal:"
echo "  cd service; $SUDO bundle exec bin/d-installer"
echo
echo "Visit http://localhost:9090/cockpit/@localhost/d-installer/index.html"
