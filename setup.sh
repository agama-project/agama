#!/bin/sh

# This script sets up the development environment without installing any
# package. This script is supposed to run within a repository clone.

sudo zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel \
  npm git augeas-devel cockpit jemalloc-devel || exit 1

sudo systemctl start cockpit

# set up the d-installer service
sudo cp service/share/dbus.conf /usr/share/dbus-1/system.d/org.opensuse.DInstaller.conf
cd service; bundle config set --local path 'vendor/bundle'; bundle install; cd -

# set up the web UI
cd web; make devel-install; cd -
sudo ln -s `pwd`/web/dist /usr/share/cockpit/d-installer

# Start the installer
echo -e "\nStart the d-installer service:\n  cd service; sudo bundle exec bin/d-installer\n"
echo -e "Visit http://localhost:9090/cockpit/@localhost/d-installer/index.html"
