#!/bin/sh

# This script sets up the development environment without installing any
# package. This script is supposed to run within a repository clone.

sudo zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel \
  'npm>=18' git augeas-devel cockpit jemalloc-devel || exit 1

sudo systemctl start cockpit

# Like "sed -e $1 < $2 > $3" but $3 is a system file owned by root
sudosed() {
  echo "$2 -> $3"
  sed -e "$1" "$2" | sudo tee "$3" > /dev/null
}

# set up the d-installer service
MYDIR=$(realpath $(dirname $0))
sudo cp -v $MYDIR/service/share/dbus.conf /usr/share/dbus-1/d-installer.conf
(
  # D-Bus service activation
  cd $MYDIR/service/share
  DBUSDIR=/usr/share/dbus-1/d-installer-services
  mkdir -p $DBUSDIR
  for SVC in org.opensuse.DInstaller*.service; do
    sudosed "s@\(Exec\)=/usr/bin/@\1=$MYDIR/service/bin/@" $SVC $DBUSDIR/$SVC
  done
  sudosed "s@\(ExecStart\)=/usr/bin/@\1=$MYDIR/service/bin/@" \
          systemd.service /usr/lib/systemd/system/d-installer.service
  sudo systemctl daemon-reload
)
cd service; bundle config set --local path 'vendor/bundle'; bundle install; cd -

# set up the web UI
cd web; make devel-install; cd -
sudo ln -snf `pwd`/web/dist /usr/share/cockpit/d-installer

# Start the installer
echo
echo "D-Bus will start the services, see journalctl for their logs."
echo "To start the services manually, logging to the terminal:"
echo "  cd service; sudo bundle exec bin/d-installer"
echo
echo "Visit http://localhost:9090/cockpit/@localhost/d-installer/index.html"
