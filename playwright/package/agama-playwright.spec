#
# spec file for package agama-playwright
#
# Copyright (c) 2023 SUSE LLC
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


Name:           agama-playwright
Version:        0
Release:        0
Summary:        Integration tests for the Agama installer
License:        GPL-2.0-only
URL:            https://github.com/openSUSE/agama
# source_validator insists that if obscpio has no version then
# tarball must neither
Source0:        agama.tar
BuildArch:      noarch
BuildRequires:  coreutils
Requires:       playwright

%description
Playwright integration tests for the Agama installer.

%prep
%autosetup -p1 -n agama

%build

%install
mkdir -p %{buildroot}%{_datadir}
tar -xf %{SOURCE0} -C %{buildroot}%{_datadir}
# rename the target directory
mv %{buildroot}%{_datadir}/agama %{buildroot}%{_datadir}/agama-playwright

%files
%defattr(-,root,root,-)
%doc README.md
%{_datadir}/agama-playwright

%changelog
