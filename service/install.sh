#!/bin/bash
set -eu
# After building this part of Agama, install it so that it is ready for run time
# This is used by agama-yast.spec and testing-in-container.sh

# The caller (RPM .spec) is expected to set these environment variables:
# SRCDIR=.
# DESTDIR=%{buildroot}
# datadir=%{_datadir}
# unitdir=%{_unitdir}

if [ "${1-}" = --system ]; then
    SRCDIR=.
    DESTDIR=""
    datadir=/usr/share
    unitdir=/usr/lib/systemd/system
fi

# install regular file, with mode 644 (not an executable with mode 755)
install6() {
    install -m 0644 "$@"
}

install6 -D "${SRCDIR}"/share/dbus.conf "${DESTDIR}${datadir}"/dbus-1/agama.conf

install6 -D -t "${DESTDIR}${datadir}"/dbus-1/agama-services "${SRCDIR}"/share/org.opensuse.Agama*.service

install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama.service 
install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama-dbus-monitor.service

install6 -D -t "${DESTDIR}${datadir}"/agama/conf.d/ "${SRCDIR}"/conf.d/*.yaml
