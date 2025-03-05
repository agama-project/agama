#!/bin/bash
set -eu
# After building this part of Agama, install it so that it is ready for run time
# This is used by agama-yast.spec and testing-in-container.sh

if [ "${1-}" = --system ]; then
    SRCDIR=.
    DESTDIR=""
    bindir=/usr/bin
    datadir=/usr/share
    unitdir=/usr/lib/systemd/system
fi
# SRCDIR=%{_builddir} # originaly "%{mod_full_name}"
# DESTDIR=%{buildroot}
# datadir=%{_datadir}
# unitdir=%{_unitdir}

# install regular file, with mode 644 (not an executable with mode 755)
install6() {
    install -m 0644 "$@"
}

# FIXME install-gem.sh?
if [ "${1-}" = --system ]; then
    # but these end up not working, because the bundler environment is elsewhere
    install -D -t "${DESTDIR}${bindir}" "${SRCDIR}"/bin/agamactl
    install -D -t "${DESTDIR}${bindir}" "${SRCDIR}"/bin/agama-autoyast
    install -D -t "${DESTDIR}${bindir}" "${SRCDIR}"/bin/agama-proxy-setup
fi

install6 -D "${SRCDIR}"/share/dbus.conf "${DESTDIR}${datadir}"/dbus-1/agama.conf

install6 -D -t "${DESTDIR}${datadir}"/dbus-1/agama-services "${SRCDIR}"/share/org.opensuse.Agama*.service

install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama.service 
install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama-dbus-monitor.service
install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama-proxy-setup.service

install6 -D -t "${DESTDIR}"/usr/share/agama/conf.d/ "${SRCDIR}"/conf.d/*.yaml 
