#!/bin/sh

# This script sets up the development environment without installing any
# package. This script is supposed to run within a repository clone.

sudo zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel \
  npm git augeas-devel cockpit || exit 1

sudo systemctl start cockpit

# set up the d-installer service
sudo cp yastd/share/dbus.conf /etc/dbus-1/system.d/d-installer.conf
cd yastd; bundle config set --local path 'vendor/bundle'; bundle install; cd -

# set up the web UI
cd web; npm install; cd -

# Start the installer
echo -e "Start the d-installer service:\n  cd yastd; sudo bundle exec bin/d-installer\n"
echo -e "Start the web UI:\n  cd web; npm start"
