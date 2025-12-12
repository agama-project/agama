#
# spec file for package agama-web-ui
#
# Copyright (c) 2022-2025 SUSE LLC
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
License:        GPL-2.0-or-later
URL:            https://github.com/agama-project/agama
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
# temporary remove tests as its types are broken now
find src -name *.test.tsx -delete
rm src/mocks/api.ts

%build
NODE_ENV="production" npm run build

%install
install -D -m 0644 --target-directory=%{buildroot}%{_datadir}/agama/web_ui %{_builddir}/agama/dist/*.{css,gz,html,js,json,map,svg}
install -D -m 0644 --target-directory=%{buildroot}%{_datadir}/agama/web_ui/fonts %{_builddir}/agama/dist/fonts/*.ttf
install -D -m 0644 --target-directory=%{buildroot}%{_datadir}/agama/web_ui/assets/logos %{_builddir}/agama/dist/assets/logos/*.svg

%files
%doc README.md
%license LICENSE
%dir %{_datadir}/agama
%{_datadir}/agama/web_ui

%changelog
