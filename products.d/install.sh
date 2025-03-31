#!/bin/bash
set -eu
# After building this part of Agama, install it so that it is ready for run time
# This is used by agama-products.spec and testing-in-container.sh

# The caller (RPM .spec) is expected to set these environment variables:
# SRCDIR=.
# DESTDIR=%{buildroot}
# datadir=%{_datadir}

if [ "${1-}" = --system ]; then
    SRCDIR=.
    DESTDIR=""
    datadir=/usr/share
fi

# install regular file, with mode 644 (not an executable with mode 755)
install6() {
    install -m 0644 "$@"
}

install6 -D -t "${DESTDIR}${datadir}"/agama/products.d "${SRCDIR}"/*.yaml
