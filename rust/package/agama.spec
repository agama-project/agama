#
# spec file for package agama
#
# Copyright (c) 2023-2025 SUSE LLC
#
# All modifications and additions to the file contributed by third parties
# remain the property of their copyright owners, unless otherwise agreed
# upon. The license for this file, and modifications and additions to the
# file, is the same license as for the pristine package itself (unless the
# license for the pristine package is not an Open Source License, in which
# case the license is the MIT License). An "Open Source License" is a
# license that conforms to the Open Source Definition (Version 1.9)
# published by the Open Source Initiative.

# Please submit bugfixes or comments via https://bugs.opensuse.org/
#

Name:           agama
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama Installer
#               If you know the license, put it's SPDX string here.
#               Alternately, you can use cargo lock2rpmprovides to help generate this.
License:        GPL-2.0-or-later
Url:            https://github.com/agama-project/agama
Source0:        agama.tar
Source1:        vendor.tar.zst

# defines the "limit_build" macro used in the "build" section below
BuildRequires:  memory-constraints
BuildRequires:  cargo-packaging
BuildRequires:  pkgconfig(openssl)
# used in tests for dbus service
BuildRequires:  dbus-1-common
Requires:       dbus-1-common
BuildRequires:  dbus-1-daemon
BuildRequires:  clang-devel
BuildRequires:  pkgconfig(pam)
# required by autoinstallation
BuildRequires:  jsonnet
Requires:       jsonnet
Requires:       lshw
# required by the password checking
BuildRequires:  libpwquality-tools
Requires:       libpwquality-tools
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

%description
Agama is a service-based Linux installer. It is composed of an HTTP-based API,
a web user interface, a command-line interface and a D-Bus service which exposes
part of the YaST libraries.

%package -n agama-autoinstall
Version:        0
Release:        0
Summary:        Agama auto-installation service
License:        GPL-2.0-or-later
Url:            https://github.com/agama-project/agama

%description -n agama-autoinstall
Agama is a service-based Linux installer. This package contains the
auto-installation service.

%package -n agama-cli
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama command-line interface
License:        GPL-2.0-only
Url:            https://github.com/agama-project/agama

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
# Require at least 1.3GB RAM per each parallel job (the size is in MB),
# this can limit the number of parallel jobs on systems with relatively small memory.
%{limit_build -m 1300}

%{cargo_build}
cargo run --package xtask -- manpages
gzip out/man/*
cargo run --package xtask -- completions
cargo run --package xtask -- openapi

%install
env \
  SRCDIR=%{_builddir}/agama \
  DESTDIR=%{buildroot} \
  NAME=%{name} \
  bindir=%{_bindir} \
  datadir=%{_datadir} \
  pamvendordir=%{_pam_vendordir} \
  unitdir=%{_unitdir} \
  libexecdir=%{_libexecdir} \
  mandir=%{_mandir} \
  %{_builddir}/agama/install.sh

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

%pre -n agama-autoinstall
%service_add_pre agama-autoinstall.service

%pre -n agama-scripts
%service_add_pre agama-scripts.service

%post
%service_add_post agama-web-server.service

%post -n agama-autoinstall
%service_add_post agama-autoinstall.service

%post -n agama-scripts
%service_add_post agama-scripts.service

%preun
%service_del_preun agama-web-server.service

%preun -n agama-autoinstall
%service_del_preun agama-autoinstall.service

%preun -n agama-scripts
%service_del_preun agama-scripts.service

%postun
%service_del_postun_with_restart agama-web-server.service

%postun -n agama-autoinstall
%service_del_postun_with_restart agama-autoinstall.service

%postun -n agama-scripts
%service_del_postun_with_restart agama-scripts.service

%files
%doc README.md
%license LICENSE
%{_bindir}/agama-web-server
%{_pam_vendordir}/agama
%{_unitdir}/agama-web-server.service

%files -n agama-autoinstall
%{_bindir}/agama-autoinstall
%{_unitdir}/agama-autoinstall.service

%files -n agama-cli
%{_bindir}/agama
%dir %{_datadir}/agama-cli
%{_datadir}/agama-cli/agama.libsonnet
%{_datadir}/agama-cli/iscsi.schema.json
%{_datadir}/agama-cli/profile.schema.json
%{_datadir}/agama-cli/storage.schema.json
%{_datadir}/agama-cli/storage.model.schema.json
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
