#! /bin/sh

# A helper script for compiling and installing the translations
# Usage:
#   install_translations po_archive.tar.bz2
#   install_translations -d po_dir
# Where the contents are ll.po ll_TT.po

set -eu

if [ "$1" = "-d" ]; then
  is_archive=false
  PODIR="$2"
else
  is_archive=true
  PODIR=$(mktemp --directory --suffix "-agama-po")
  tar xfjv "$1" -C "$PODIR"
fi

export DESTDIR="$RPM_BUILD_ROOT"
# export localedir=/usr/share/locale
export localedir=/usr/share/YaST2/locale

find "$PODIR" -name "*.po" -exec sh -c '
  LL=`basename "$1" .po` &&
    mkdir -p  "${DESTDIR}${localedir}/$LL/LC_MESSAGES" &&
    msgfmt -o "${DESTDIR}${localedir}/$LL/LC_MESSAGES/agama.mo" "$1"
  ' sh {} \;

if $is_archive; then
  rm -rf "$PODIR"
fi
