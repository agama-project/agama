#! /bin/sh
sudo zypper --non-interactive install gcc gcc-c++ make openssl-devel ruby-devel \
  npm git augeas-devel cockpit || exit 1

git clone https://github.com/yast/the-installer || exit 1
cd the-installer

# set up yastd
sudo cp yastd/share/dbus-yastd.conf /etc/dbus-1/system.d/yastd.conf
cd yastd; bundle config set --local path 'vendor/bundle'; bundle install; cd -
cd yastd; sudo bundle.ruby3.1 exec bin/yastd& cd -

# set up the web UI
cd web; npm install; npm run build; cd -
sudo mkdir /usr/share/cockpit/static/installer
sudo mount -o bind web/build /usr/share/cockpit/static/installer
sudo systemctl start cockpit

# set 'linux' as password
echo "linux:Nk1RhI1GqlxdA" | sudo chpasswd -e linux

# open the installer
xdg-open http://localhost:9090/cockpit/static/installer/index.html

wait
