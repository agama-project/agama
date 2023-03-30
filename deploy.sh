#!/bin/sh

# This script is supposed to be used in an openSUSE Tumbleweed Live DVD.

sudo rpm --import https://build.opensuse.org/projects/YaST/public_key
sudo zypper ar -f \
	https://download.opensuse.org/repositories/YaST:/Head:/Agama/openSUSE_Tumbleweed/YaST:Head:Agama.repo
RUBY_VERSION=ruby:$(rpm --eval '%{rb_ver}')
sudo zypper --non-interactive in --no-recommends \
	"rubygem($RUBY_VERSION:agama)" \
	cockpit-agama \
	cockpit

sudo systemctl start cockpit
sudo systemctl start agama

# set 'linux' as password
echo "linux:Nk1RhI1GqlxdA" | sudo chpasswd -e linux

xdg-open http://localhost:9090/cockpit/@localhost/agama/index.html
