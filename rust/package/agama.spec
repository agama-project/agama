#
# spec file for package agama
#
# Copyright (c) 2023-2024 SUSE LLC
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

Name:           agama
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama Installer
#               If you know the license, put it's SPDX string here.
#               Alternately, you can use cargo lock2rpmprovides to help generate this.
License:        GPL-2.0-or-later
Url:            https://github.com/opensuse/agama
Source0:        agama.tar
Source1:        vendor.tar.zst

BuildRequires:  cargo-packaging
BuildRequires:  pkgconfig(openssl)
# used in tests for dbus service
BuildRequires:  dbus-1-common
Requires:       dbus-1-common
# required by agama-dbus-server integration tests
BuildRequires:  dbus-1-daemon
BuildRequires:  clang-devel
BuildRequires:  pkgconfig(pam)
# required by autoinstallation
Requires:       jsonnet
Requires:       lshw
# required by "agama logs store"
Requires:       gzip
# required to compress the manual pages
Requires:       tar
# required for translating the keyboards descriptions
BuildRequires:  xkeyboard-config-lang
Requires:       xkeyboard-config-lang
# required for getting the list of timezones
Requires:       timezone
BuildRequires:  timezone
# required for getting the languages information
BuildRequires:  python-langtable-data
Requires:       python-langtable-data
# dependency on the YaST part of Agama
Requires:       agama-yast

# conflicts with the old packages
Conflicts:      agama-dbus-server

%description
Agama is a service-based Linux installer. It is composed of an HTTP-based API,
a web user interface, a command-line interface and a D-Bus service which exposes
part of the YaST libraries.

%package -n agama-cli
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama command-line interface
License:        GPL-2.0-only
Url:            https://github.com/opensuse/agama

%description -n agama-cli
Command line program to interact with the Agama installer.

%package -n agama-cli-bash-completion
Summary:        Bash Completion for %{name}-cli
Group:          System/Shells
Supplements:    (%{name}-cli and bash-completion)
Requires:       %{name}-cli = %{version}
Requires:       bash-completion
BuildArch:      noarch

%description -n agama-cli-bash-completion
Bash command-line completion support for %{name}.

%package -n agama-cli-fish-completion
Summary:        Fish Completion for %{name}-cli
Group:          System/Shells
Supplements:    (%{name}-cli and fish)
Requires:       %{name}-cli = %{version}
Requires:       fish
BuildArch:      noarch

%description -n agama-cli-fish-completion
Fish command-line completion support for %{name}-cli.

%package -n agama-cli-zsh-completion
Summary:        Zsh Completion for %{name}-cli
Group:          System/Shells
Supplements:    (%{name}-cli and zsh)
Requires:       %{name}-cli = %{version}
Requires:       zsh
BuildArch:      noarch

%description -n agama-cli-zsh-completion
Zsh command-line completion support for %{name}-cli.

%package -n agama-openapi
Summary:        Agama's OpenAPI Specification

%description -n agama-openapi
The OpenAPI Specification (OAS) allows describing an HTTP API in an standard and
language-agnostic way. This package contains the specification for Agama's HTTP
API.

%package -n agama-scripts
Summary:        Agama support for running user-defined scripts

%description -n agama-scripts
The Agama installer supports running user-defined scripts during and after the installation. This
package contains a systemd service to run scripts when booting the installed system.

%prep
%autosetup -a1 -n agama
# Remove exec bits to prevent an issue in fedora shebang checking. Uncomment only if required.
# find vendor -type f -name \*.rs -exec chmod -x '{}' \;

%build
%{cargo_build}
cargo run --package xtask -- manpages
gzip out/man/*
cargo run --package xtask -- completions
cargo run --package xtask -- openapi

%install
install -D -d -m 0755 %{buildroot}%{_bindir}
install -m 0755 %{_builddir}/agama/target/release/agama %{buildroot}%{_bindir}/agama
install -m 0755 %{_builddir}/agama/target/release/agama-dbus-server %{buildroot}%{_bindir}/agama-dbus-server
install -m 0755 %{_builddir}/agama/target/release/agama-web-server %{buildroot}%{_bindir}/agama-web-server
install -D -p -m 644 %{_builddir}/agama/share/agama.pam $RPM_BUILD_ROOT%{_pam_vendordir}/agama
install -D -d -m 0755 %{buildroot}%{_datadir}/agama-cli
install -m 0644 %{_builddir}/agama/agama-lib/share/profile.schema.json %{buildroot}%{_datadir}/agama-cli
install -m 0644 %{_builddir}/agama/share/agama.libsonnet %{buildroot}%{_datadir}/agama-cli
install --directory %{buildroot}%{_datadir}/dbus-1/agama-services
install -m 0644 --target-directory=%{buildroot}%{_datadir}/dbus-1/agama-services %{_builddir}/agama/share/org.opensuse.Agama1.service
install -D -m 0644 %{_builddir}/agama/share/agama-web-server.service %{buildroot}%{_unitdir}/agama-web-server.service
install -D -d -m 0755 %{buildroot}%{_libexecdir}
install -D -m 0755 %{_builddir}/agama/share/agama-scripts.sh %{buildroot}%{_libexecdir}/agama-scripts.sh
install -D -m 0644 %{_builddir}/agama/share/agama-scripts.service %{buildroot}%{_unitdir}/agama-scripts.service
install -D -m 0644 %{_builddir}/agama/share/agama-dbus-monitor.service %{buildroot}%{_unitdir}/agama-dbus-monitor.service

# install manpages
mkdir -p %{buildroot}%{_mandir}/man1
install -m 0644 %{_builddir}/agama/out/man/* %{buildroot}%{_mandir}/man1/

# install shell completion scripts
install -Dm644 %{_builddir}/agama/out/shell/%{name}.bash %{buildroot}%{_datadir}/bash-completion/completions/%{name}
install -Dm644 %{_builddir}/agama/out/shell/_%{name} %{buildroot}%{_datadir}/zsh/site-functions/_%{name}
install -Dm644 %{_builddir}/agama/out/shell/%{name}.fish %{buildroot}%{_datadir}/fish/vendor_completions.d/%{name}.fish

# install OpenAPI specification
mkdir -p %{buildroot}%{_datadir}/agama/openapi
install -m 0644 %{_builddir}/agama/out/openapi/* %{buildroot}%{_datadir}/agama/openapi

%check
PATH=$PWD/share/bin:$PATH
%ifarch aarch64
/usr/bin/cargo auditable test -j1 --offline --no-fail-fast
%else
echo $PATH
%{cargo_test}
%endif

%pre
%service_add_pre agama-web-server.service
%service_add_pre agama-dbus-monitor.service

%pre -n agama-scripts
%service_add_pre agama-scripts.service

%post
%service_add_post agama-web-server.service
%service_add_post agama-dbus-monitor.service

%post -n agama-scripts
%service_add_post agama-scripts.service

%preun
%service_del_preun agama-web-server.service
%service_del_preun agama-dbus-monitor.service

%preun -n agama-scripts
%service_del_preun agama-scripts.service

%postun
%service_del_postun_with_restart agama-web-server.service
%service_del_postun_with_restart agama-dbus-monitor.service

%postun -n agama-scripts
%service_del_postun_with_restart agama-scripts.service

%files
%doc README.md
%license LICENSE
%{_bindir}/agama-dbus-server
%{_bindir}/agama-web-server
%{_datadir}/dbus-1/agama-services
%{_pam_vendordir}/agama
%{_unitdir}/agama-web-server.service
%{_unitdir}/agama-dbus-monitor.service

%files -n agama-cli
%{_bindir}/agama
%dir %{_datadir}/agama-cli
%{_datadir}/agama-cli/agama.libsonnet
%{_datadir}/agama-cli/profile.schema.json
%{_mandir}/man1/agama*1%{?ext_man}

%files -n agama-cli-bash-completion
%{_datadir}/bash-completion/*

%files -n agama-cli-fish-completion
%dir %{_datadir}/fish
%{_datadir}/fish/*

%files -n agama-cli-zsh-completion
%dir %{_datadir}/zsh
%{_datadir}/zsh/*

%files -n agama-openapi
%dir %{_datadir}/agama
%dir %{_datadir}/agama/openapi
%{_datadir}/agama/openapi/*.json

%files -n agama-scripts
%{_unitdir}/agama-scripts.service
%{_libexecdir}/agama-scripts.sh

%changelog
