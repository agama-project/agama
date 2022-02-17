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


Name:           d-installer-web
Version:        0
Release:        0
Summary:        Web-based user interface for D-Installer
License:        GPL-2.0-only
URL:            https://github.com/yast/d-installer
# source_validator insists that if obscpio has no version then
# tarball must neither
Source:         d-installer-web.tar
Source10:       package-lock.json
Source11:       node_modules.spec.inc
%include %_sourcedir/node_modules.spec.inc
BuildArch:      noarch
Requires:       cockpit
BuildRequires:  cockpit
BuildRequires:  cockpit-devel >= 243
BuildRequires:  local-npm-registry

%description
Web-based user interface for the experimental YaST D-Installer.


%prep
%autosetup -p1 -n %{name}
rm -f package-lock.json
local-npm-registry %{_sourcedir} install --with=dev --legacy-peer-deps || ( find ~/.npm/_logs -name '*-debug.log' -print0 | xargs -0 cat; false)

%build
NODE_ENV=production npm run build

%install
mkdir -p %{buildroot}/%{_datadir}/cockpit/static/installer
cp -R --no-dereference --preserve=mode,links -v build/* %{buildroot}/%{_datadir}/cockpit/static/installer

%files
%doc README.md
#%license LICENSE dist/index.js.LICENSE.txt.gz
%{_datadir}/cockpit/static/installer

%changelog
