#
# spec file for package cockpit-machines
#
# Copyright (c) 2022 SUSE LLC
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


Name:           agama-web-ui
Version:        0
Release:        0
Summary:        Web UI for Agama installer
License:        GPL-2.0-only
URL:            https://github.com/openSUSE/agama
# source_validator insists that if obscpio has no version then
# tarball must neither
Source0:        agama.tar
Source10:       package-lock.json
Source11:       node_modules.spec.inc
Source12:       node_modules.sums
%include %_sourcedir/node_modules.spec.inc
BuildArch:      noarch
BuildRequires:  local-npm-registry
BuildRequires:  appstream-glib

%description
Agama web UI for the experimental Agama installer.

%prep
%autosetup -p1 -n agama
rm -f package-lock.json
local-npm-registry %{_sourcedir} install --with=dev --legacy-peer-deps || ( find ~/.npm/_logs -name '*-debug.log' -print0 | xargs -0 cat; false)

%build
NODE_ENV="production" npm run build

%install
install -D -m 0644 --target-directory=%{buildroot}%{_datadir}/agama/web_ui %{_builddir}/agama/dist/*.{gz,html,js,map,svg}
install -D -m 0644 --target-directory=%{buildroot}%{_datadir}/agama/web_ui/fonts %{_builddir}/agama/dist/fonts/*.woff?

%files
%doc README.md
%dir %{_datadir}/agama
%{_datadir}/agama/web_ui

%changelog
