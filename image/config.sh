#! /bin/bash

# KIWI functions
test -f /.kconfig && . /.kconfig
test -f /.profile && . /.profile

# greeting
echo "Configure image: [$kiwi_iname]..."

# setup baseproduct link
suseSetupProduct

# activate services
systemctl enable sshd.service
systemctl enable NetworkManager.service
systemctl enable d-installer.service
systemctl enable x11-autologin.service

# default target
systemctl set-default graphical.target
