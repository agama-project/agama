#! /bin/sh
sudo zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel npm git augeas-devel || exit 1

git clone https://github.com/yast/the-installer || exit 1
cd the-installer
sudo cp yastd/share/dbus-yastd.conf /etc/dbus-1/system.d/yastd.conf
cd yastd; bundle config --set local path vendor/bundle; bundle install; cd -
cd yastd-proxy; bundle config --set local path vendor/bundle; bundle install; cd -
cd web; npm install; cd -
cd yastd; sudo bundle exec bin/yastd& cd -
cd yastd-proxy; bundle exec bin/yastd-proxy& cd -
cd web; npm start& cd -

wait
