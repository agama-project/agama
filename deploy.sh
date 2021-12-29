#! /bin/sh
sudo zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel npm git

git clone https://github.com/yast/the-installer
cd the-installer
sudo cp yastd/share/dbus-yastd.conf /etc/dbus-1/system.d/yastd.conf
cd yastd; bundle install; cd -
cd yastd-proxy; bundle install; cd -
cd web; npm install
cd yastd; sudo bundle exec bin/yastd&; cd -
cd yastd-proxy; sudo bundle exec bin/yastd-proxy&; cd -
cd web; npm start&; cd -

wait
