#!/bin/bash
set -eu
# After building this part of Agama, install it so that it is ready for run time
# This is used by agama.spec and testing-in-container.sh

# The caller (RPM .spec) is expected to set these environment variables:
# NAME=%{name}
# SRCDIR=.
# DESTDIR=%{buildroot}
# bindir=%{_bindir}
# datadir=%{_datadir}
# pamvendordir=%{_pam_vendordir}
# unitdir=%{_unitdir}
# libexecdir=%{_libexecdir}
# mandir=%{_mandir}
# pamvendordir=%{_pam_vendordir}
: ${RUST_TARGET:=release}

if [ "${1-}" = --system ]; then
    SRCDIR=.
    DESTDIR=""
    NAME=agama
    RUST_TARGET=debug
    bindir=/usr/bin
    datadir=/usr/share
    mandir=/usr/share/man
    libexecdir=/usr/lib
    unitdir=/usr/lib/systemd/system
    pamvendordir=/etc/pam.d
fi

# install regular file, with mode 644 (not an executable with mode 755)
install6() {
    install -m 0644 "$@"
}

install -D -t "${DESTDIR}${bindir}" "${SRCDIR}/target/${RUST_TARGET}/agama"
install -D -t "${DESTDIR}${bindir}" "${SRCDIR}/target/${RUST_TARGET}/agama-autoinstall"
install -D -t "${DESTDIR}${bindir}" "${SRCDIR}/target/${RUST_TARGET}/agama-web-server"

install6 -D -p "${SRCDIR}"/share/agama.pam "${DESTDIR}${pamvendordir}"/agama

install6 -D -t "${DESTDIR}${datadir}"/agama/schema "${SRCDIR}"/agama-lib/share/iscsi.schema.json
install6 -D -t "${DESTDIR}${datadir}"/agama/schema "${SRCDIR}"/agama-lib/share/profile.schema.json
install6 -D -t "${DESTDIR}${datadir}"/agama/schema "${SRCDIR}"/agama-lib/share/software.schema.json
install6 -D -t "${DESTDIR}${datadir}"/agama/schema "${SRCDIR}"/agama-lib/share/storage.schema.json
install6 -D -t "${DESTDIR}${datadir}"/agama/schema "${SRCDIR}"/agama-lib/share/storage.model.schema.json
install6 -D -t "${DESTDIR}${datadir}"/agama/jsonnet "${SRCDIR}"/share/agama.libsonnet

install -D -t "${DESTDIR}${libexecdir}" "${SRCDIR}"/share/agama-scripts.sh

install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama-autoinstall.service
install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama-scripts.service
install6 -D -t "${DESTDIR}${unitdir}" "${SRCDIR}"/share/agama-web-server.service

# create the licenses directory
install -d -m 0755 "${DESTDIR}${datadir}"/agama/eula

# install manpages
install6 -D -t "${DESTDIR}${mandir}"/man1 "${SRCDIR}"/out/man/* 

# install shell completion scripts
install6 -D "${SRCDIR}"/out/shell/"${NAME}".bash "${DESTDIR}${datadir}/bash-completion/completions/${NAME}"
install6 -D -t "${DESTDIR}${datadir}"/zsh/site-functions "${SRCDIR}"/out/shell/_"${NAME}"
install6 -D -t "${DESTDIR}${datadir}"/fish/vendor_completions.d "${SRCDIR}"/out/shell/"${NAME}".fish 

# install OpenAPI specification
install6 -D -t "${DESTDIR}${datadir}"/agama/openapi "${SRCDIR}"/out/openapi/*

# install translations
make -C "${SRCDIR}/po"
make -C "${SRCDIR}/po" install DESTDIR="${DESTDIR}"
