#!/bin/sh -x

# Using a git checkout in the current directory and set up the services, so that it can be used by:
# - the web frontend (as set up by setup-web.sh)
# - the CLI
# or both

# Exit on error; unset variables are an error.
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
$SUDO systemctl list-unit-files agama-dbus-monitor.service &>/dev/null && $SUDO systemctl stop agama-dbus-monitor.service
$SUDO systemctl list-unit-files agama-web-server.service &>/dev/null && $SUDO systemctl stop agama-web-server.service

# Ruby services

ZYPPER="zypper --non-interactive -v"

# Packages required for Ruby development (i.e., bundle install).
$SUDO $ZYPPER install \
  gcc \
  gcc-c++ \
  git \
  make \
  openssl-devel \
  ruby-devel \
  augeas-devel || exit 1

# Packages required by Agama Ruby services (see ./service/package/gem2rpm.yml).
# TODO extract list from gem2rpm.yml
$SUDO $ZYPPER install \
  dbus-1-common \
  dbus-1-daemon \
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
  yast2-schema \
  yast2-storage-ng \
  yast2-users \
  bcache-tools \
  btrfsprogs \
  cryptsetup \
  dmraid \
  dosfstools \
  e2fsprogs \
  exfatprogs \
  f2fs-tools \
  fcoe-utils \
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

# Install x86_64 packages
if [ $(uname -m) == "x86_64" ]; then
  $SUDO $ZYPPER install \
    fde-tools
fi

# Install s390 packages
if [ $(uname -m) == "s390x" ]; then
  $SUDO $ZYPPER install \
    yast2-s390 \
    yast2-reipl \
    yast2-cio
fi

# Rubygem dependencies
(
  cd $MYDIR/service

  if [ -d /checkout-ruby-dbus ]; then
      # we are in a container, told to use that one
      # instead of a released version
      # edit +Gemfile and -gemspec
      sed -e '/ruby-dbus/d' -i Gemfile agama-yast.gemspec
      sed -e '/gemspec/a gem "ruby-dbus", path: "/checkout-ruby-dbus"' -i Gemfile
  fi

  if [ -n "${CI:-}" ]; then
    # in CI reuse the pre-installed system gems from RPMs
    bundle config set --local disable_shared_gems 0
    $SUDO bundle install
  else
    bundle config set --local path 'vendor/bundle'
    bundle install
  fi

)

# Rust service, CLI and auto-installation.

# Only install cargo if it is not available (avoid conflicts with rustup)
which cargo || $SUDO $ZYPPER install cargo

# Packages required by Rust code (see ./rust/package/agama.spec)
$SUDO $ZYPPER install \
  clang-devel \
  gzip \
  jsonnet \
  lshw \
  NetworkManager \
  pam-devel \
  python-langtable-data \
  tar \
  timezone \
  xkeyboard-config-lang || exit 1

(
  cd $MYDIR/rust
  cargo build

  $SUDO ln -sft /usr/bin $MYDIR/rust/target/debug/agama{,*server}
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

  sudosed "s@\(ExecStart\)=/usr/bin/@\1=$MYDIR/rust/target/debug/@" \
    agama-web-server.service /usr/lib/systemd/system/agama-web-server.service

  $SUDO cp -f agama.pam /usr/lib/pam.d/agama
)

# copy D-Bus monitor service
$SUDO cp -vf $MYDIR/service/share/agama-dbus-monitor.service /usr/lib/systemd/system/agama-dbus-monitor.service
$SUDO chmod 0600 /usr/lib/systemd/system/agama-dbus-monitor.service

# copy the product files
$SUDO mkdir -p /usr/share/agama/products.d
$SUDO cp -f $MYDIR/products.d/*.yaml /usr/share/agama/products.d

# - Make sure NetworkManager is running
if [ -n "${DISTROBOX_ENTER_PATH:-}" ]; then
  AGAMA_WEB_SERVER_SVC="/usr/lib/systemd/system/agama-web-server.service"
  grep -q DBUS_SYSTEM_BUS_ADDRESS $AGAMA_WEB_SERVER_SVC || $SUDO sed -i \
    -e '/\[Service\]/a Environment="DBUS_SYSTEM_BUS_ADDRESS=unix:path=/run/host/run/dbus/system_bus_socket"' \
    $AGAMA_WEB_SERVER_SVC

  AGAMA_SVC="/usr/lib/systemd/system/agama.service"
  grep -q DBUS_SYSTEM_BUS_ADDRESS $AGAMA_SVC || $SUDO sed -i \
    -e '/\[Service\]/a Environment="DBUS_SYSTEM_BUS_ADDRESS=unix:path=/run/host/run/dbus/system_bus_socket"' \
    $AGAMA_SVC
else
  $SUDO systemctl start NetworkManager
fi

# systemd reload and start of service
(
  $SUDO systemctl daemon-reload
  # Start the separate dbus-daemon for Agama
  $SUDO systemctl start agama.service
  # Start the web server
  $SUDO systemctl start agama-web-server.service
)
