#! /bin/sh

# a helper script for compiling and installing the translations

PODIR=$(mktemp --directory --suffix "-agama-po")

tar xfjv "$1" -C "$PODIR"
find "$PODIR" -name "*.po" -exec sh -c 'L=`basename "{}" .po` && mkdir -p "$RPM_BUILD_ROOT/usr/share/YaST2/locale/$L/LC_MESSAGES" && msgfmt -o "$RPM_BUILD_ROOT/usr/share/YaST2/locale/$L/LC_MESSAGES/agama.mo" "{}"' \;

rm -rf "$PODIR"
