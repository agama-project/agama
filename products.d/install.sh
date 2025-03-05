#!/bin/bash
set -eu
# After building this part of Agama, install it so that it is ready for run time
# This is used by agama-products.spec and testing-in-container.sh

if [ "${1-}" = --system ]; then
    SRCDIR=.
    DESTDIR=""
    datadir=/usr/share
fi
# DESTDIR=%{buildroot}
# datadir=%{_datadir}

# install regular file, with mode 644 (not an executable with mode 755)
install6() {
    install -m 0644 "$@"
}

install6 -D -t "${DESTDIR}${datadir}"/agama/products.d "${SRCDIR}"/*.yaml
