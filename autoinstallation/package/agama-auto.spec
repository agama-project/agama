#
# spec file for package agama-auto
#
# Copyright (c) 2024 SUSE LLC
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

Name:           agama-auto
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Agama auto-installation service
License:        GPL-2.0-only
Url:            https://github.com/opensuse/agama
Source0:        agama.tar
BuildArch:      noarch
Requires:       agama-cli

%description
Agama is a service-based Linux installer. This package contains the
auto-installation service.

%prep
%autosetup -a0 -n agama

%install
install -D -d -m 0755 %{buildroot}%{_bindir}
install -m 0755 %{_builddir}/agama/bin/agama-auto %{buildroot}%{_bindir}/agama-auto
install -D -m 0644 %{_builddir}/agama/systemd/agama-auto.service %{buildroot}%{_unitdir}/agama-auto.service

%pre
%service_add_pre agama-auto.service

%post
%service_add_post agama-auto.service

%preun
%service_del_preun agama-auto.service

%postun
%service_del_preun agama-auto.service

%files
%doc README.md
%license LICENSE
%{_bindir}/agama-auto
%{_unitdir}/agama-auto.service

%changelog
