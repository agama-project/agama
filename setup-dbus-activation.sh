#!/bin/sh
# FIXME: inline this in setup.sh

MYDIR=$(realpath $(dirname $0))
cd $MYDIR/service/share

# systemd
#for SVC in d-installer*.service; do
#  sudo cp -v $SVC /usr/lib/systemd/system
#  sudo systemctl enable $SVC
#done

# D-Bus
DBUSDIR=/usr/share/dbus-1/system-services
for SVC in org.opensuse.DInstaller*.service; do
  echo $SVC
  sed -e "s@Exec=/usr/bin/@Exec=$MYDIR/service/bin/@" $SVC | sudo tee $DBUSDIR/$SVC > /dev/null
done
