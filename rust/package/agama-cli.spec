#
# spec file for package agama-cli
#
# Copyright (c) 2023 SUSE LINUX GmbH, Nuernberg, Germany.
#
# All modifications and additions to the file contributed by third parties
# remain the property of their copyright owners, unless otherwise agreed
# upon. The license for this file, and modifications and additions to the
# file, is the same license as for the pristine package itself (unless the
# license for the pristine package is not an Open Source License, in which
# case the license is the MIT License). An "Open Source License" is a
# license that conforms to the Open Source Definition (Version 1.9)
# published by the Open Source Initiative.

# Please submit bugfixes or comments via http://bugs.opensuse.org/
#

Name:           agama-cli
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama command line interface
#               If you know the license, put it's SPDX string here.
#               Alternately, you can use cargo lock2rpmprovides to help generate this.
License:        GPL-2.0-only
Url:            https://github.com/opensuse/agama
Source0:        agama.tar
Source1:        vendor.tar.zst
BuildRequires:  cargo-packaging
BuildRequires:  pkgconfig(openssl)
# used in tests for dbus service
BuildRequires:  python-langtable-data
BuildRequires:  timezone
BuildRequires:  dbus-1-common
# required by agama-dbus-server integration tests
BuildRequires:  dbus-1-daemon
Requires:       jsonnet
Requires:       lshw
# required by "agama logs store"
Requires:       bzip2
Requires:       tar
# required for translating the keyboards descriptions
Requires:       xkeyboard-config-lang
# required for getting the list of timezones
Requires:       timezone

%description
Command line program to interact with the agama service.

%package -n agama-dbus-server
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama Rust D-Bus service
License:        GPL-2.0-only
Url:            https://github.com/opensuse/agama
Requires:       python-langtable-data
Requires:       dbus-1-common

%description -n agama-dbus-server
DBus service for agama project. It provides so far localization service.

%prep
%autosetup -a1 -n agama
# Remove exec bits to prevent an issue in fedora shebang checking. Uncomment only if required.
# find vendor -type f -name \*.rs -exec chmod -x '{}' \;

%build
%{cargo_build}

%install
install -D -d -m 0755 %{buildroot}%{_bindir}
install -m 0755 %{_builddir}/agama/target/release/agama %{buildroot}%{_bindir}/agama
install -m 0755 %{_builddir}/agama/target/release/agama-dbus-server %{buildroot}%{_bindir}/agama-dbus-server
install -D -d -m 0755 %{buildroot}%{_datadir}/agama-cli
install -m 0644 %{_builddir}/agama/agama-lib/share/profile.schema.json %{buildroot}%{_datadir}/agama-cli
install --directory %{buildroot}%{_datadir}/dbus-1/agama-services
install -m 0644 --target-directory=%{buildroot}%{_datadir}/dbus-1/agama-services %{_builddir}/agama/share/*.service


%check
%ifarch aarch64
/usr/bin/cargo auditable test -j1 --offline --no-fail-fast
%else
%{cargo_test}
%endif

%files
%{_bindir}/agama
%dir %{_datadir}/agama-cli
%{_datadir}/agama-cli/profile.schema.json

%files -n agama-dbus-server
%{_bindir}/agama-dbus-server
%{_datadir}/dbus-1/agama-services

%changelog
