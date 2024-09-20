#!/usr/bin/bash

# Script that do initial setup for libzypp ng bindings development.
# To update git submodules use
# git submodule update --remote
#
# It needs TW as dev env. One of option is to use distrobox as shown:
# ```sh
#   distrobox create --image tumbleweed --name zyppng
#   distrobox enter zyppng # if stuck see https://github.com/89luca89/distrobox/issues/1530 and kill and run again
#   # and now you are inside dev env where you run this script
#   # to clean use distrobox stop zyppng and if no longer image is needed use distrobox rm zyppng
# ```

set -eu
BASEDIR=$(dirname "$0")

# Helper:
# Ensure root privileges for the installation.
# In a testing container, we are root but there is no sudo.
if [ $(id --user) != 0 ]; then
  SUDO=sudo
  if [ "$($SUDO id --user)" != 0 ]; then
    echo "We are not root and cannot sudo, cannot continue."
    exit 1
  fi
else
  SUDO=""
fi

$SUDO zypper --non-interactive rm rust\* || true

# install all required packages and only required as recommends are really huge
$SUDO zypper --non-interactive install --no-recommends \
  git \
  cmake \
  openssl \
  libudev1 \
  libboost_headers-devel \
  libboost_program_options-devel \
  libboost_test-devel \
  libboost_thread-devel \
  dejagnu \
  gcc-c++ \
  gettext-devel \
  graphviz \
  libxml2-devel \
  yaml-cpp-devel \
  gobject-introspection-devel \
  libproxy-devel \
  pkg-config \
  libsolv-devel \
  libsolv-tools-base \
  glib2-devel \
  libsigc++2-devel \
  readline-devel \
  nginx \
  vsftpd \
  rpm \
  rpm-devel \
  libgpgme-devel \
  FastCGI-devel \
  libcurl-devel \
  "rubygem(asciidoctor)" \
  libzck-devel \
  libzstd-devel \
  libbz2-devel \
  xz-devel \
  rustup

cd "$BASEDIR"
# checkout submodules
git submodule init
git submodule update --checkout

# lets build libzypp
cd libzypp
make -f Makefile.cvs
cmake -D BUILD_GLIB_API=ON -D DISABLE_AUTODOCS=ON
make -j$(nproc)
$SUDO make install
cd -

# now lets make rust working
rustup install stable
# lets install gir
cd gir
# workaround for badly working exclude in cargo see https://github.com/rust-lang/cargo/issues/6745
if ! grep -q '\[workspace\]' Cargo.toml; then
  printf '\n[workspace]' >> Cargo.toml
fi
cargo install --path .
cd -

# to use gir follow https://gtk-rs.org/gir/book/tutorial/sys_library.html

# install doc tool
cargo install rustdoc-stripper

cargo build

echo 'To test if everything work run `../target/debug/zypprs`'
