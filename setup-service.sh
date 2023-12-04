#!/bin/sh -x

# Using a git checkout in the current directory,
# set up the service (backend) part of agama
# so that it can be used by
# - the web frontend (as set up by setup.sh)
# - the CLI
# or both

# Exit on error; unset variables are an error
set -eu

MYDIR=$(realpath $(dirname $0))

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

# Helper:
# Like "sed -e $1 < $2 > $3" but $3 is a system file owned by root
sudosed() {
  echo "$2 -> $3"
  sed -e "$1" "$2" | $SUDO tee "$3" > /dev/null
}

# if agama is already running -> stop it
$SUDO systemctl list-unit-files agama.service &>/dev/null && $SUDO systemctl stop agama.service

# Ruby services

# Packages required for Ruby development (i.e., bundle install).
$SUDO zypper --non-interactive --gpg-auto-import-keys install \
gcc \
gcc-c++ \
make \
openssl-devel \
ruby-devel \
augeas-devel || exit 1

# Packages required by Agama Ruby services (see ./service/package/gem2rpm.yml).
# TODO extract list from gem2rpm.yml
$SUDO zypper --non-interactive --gpg-auto-import-keys install \
dbus-1-common \
suseconnect-ruby-bindings \
autoyast2-installation \
yast2 \
yast2-bootloader \
yast2-country \
yast2-hardware-detection \
yast2-installation \
yast2-iscsi-client \
yast2-network \
yast2-proxy \
yast2-storage-ng \
yast2-users \
bcache-tools \
btrfsprogs \
cryptsetup \
dmraid \
dosfstools \
e2fsprogs \
exfat-utils \
f2fs-tools \
fcoe-utils \
fde-tools \
jfsutils \
libstorage-ng-lang \
lvm2 \
mdadm \
multipath-tools \
nilfs-utils \
nfs-client \
ntfs-3g \
ntfsprogs \
nvme-cli \
open-iscsi \
quota \
snapper \
udftools \
xfsprogs || exit 1

# - Install service rubygem dependencies
# Install s390 pakcages (do not exit on failure).
$SUDO zypper --non-interactive --gpg-auto-import-keys install \
yast2-s390 \
yast2-reipl \
yast2-cio

# Rubygem dependencies
(
  cd $MYDIR/service
  bundle config set --local path 'vendor/bundle'
  bundle install
)

# Rust service

# This repo can be removed once python-language-data reaches Factory.
test -f /etc/zypp/repos.d/d_l_python.repo || \
  $SUDO zypper --non-interactive \
    addrepo https://download.opensuse.org/repositories/devel:/languages:/python/openSUSE_Tumbleweed/ d_l_python

# Only install cargo if it is not available (avoid conflicts with rustup)
which cargo || $SUDO zypper --non-interactive install cargo

(
  cd $MYDIR/rust
  cargo build
)

# - D-Bus configuration
$SUDO cp -v $MYDIR/service/share/dbus.conf /usr/share/dbus-1/agama.conf

# - D-Bus activation configuration
#   (this could be left out but then we would rely
#    on the manual startup via bin/agamactl)
(
  cd $MYDIR/service/share
  DBUSDIR=/usr/share/dbus-1/agama-services

  # cleanup previous installation
  [[ -d $DBUSDIR ]] && $SUDO rm -r $DBUSDIR

  # create services
  $SUDO mkdir -p $DBUSDIR
  for SVC in org.opensuse.Agama*.service; do
    sudosed "s@\(Exec\)=/usr/bin/@\1=$MYDIR/service/bin/@" $SVC $DBUSDIR/$SVC
  done
  sudosed "s@\(ExecStart\)=/usr/bin/@\1=$MYDIR/service/bin/@" \
    agama.service /usr/lib/systemd/system/agama.service
)

# and same for rust service
(
  cd $MYDIR/rust/share
  DBUSDIR=/usr/share/dbus-1/agama-services
  for SVC in org.opensuse.Agama*.service; do
    # it is intention to use debug here to get more useful debugging output
    sudosed "s@\(Exec\)=/usr/bin/@\1=$MYDIR/rust/target/debug/@" $SVC $DBUSDIR/$SVC
  done
)

# systemd reload and start of service
(
  $SUDO systemctl daemon-reload
  # Start the separate dbus-daemon for Agama
  # (in CI we run a custom cockpit-ws which replaces the cockpit.socket
  # dependency, continue in that case)
  $SUDO systemctl start agama.service || pgrep cockpit-ws
)

# - Make sure NetworkManager is running
$SUDO systemctl start NetworkManager
