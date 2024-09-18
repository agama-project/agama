#!/usr/bin/bash

# Script that do initial setup for libzypp ng bindings development.
# To update git submodules use
# git submodule update --remote

BASEDIR=$(dirname "$0")

# install all required packages and only required as recommends are really huge
sudo zypper --non-interactive install --no-recommends \
  git \
  cmake \
  openssl \
  libudev1 \
  libboost_headers-devel \
  libboost_program_options-devel \
  libboost_test-devel \
  libboost_thread-devel \
  dejagnu \
  doxygen \
  texlive-latex \
  texlive-xcolor \
  texlive-newunicodechar \
  texlive-dvips \
  ghostscript \
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
make
sudo make install
cd -

# now lets make rust working
rustup install stable
# lets install gir
cd gir
cargo install --path .
cd -

# to use gir follow https://gtk-rs.org/gir/book/tutorial/sys_library.html

cargo build

echo "To test if everything work run `../target/debug/zypprs`"
