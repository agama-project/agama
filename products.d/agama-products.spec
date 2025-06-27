#
# spec file for package agama-products
#
# Copyright (c) 2025 SUSE LLC
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


Name:           agama-products
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Definition of products for the Agama installer
License:        GPL-2.0-only
URL:            https://github.com/agama-project/agama
BuildArch:      noarch
Source0:        agama.tar

%description
Products definition for Agama installer.

%prep
%autosetup -a0 -n agama

%build

%install
env \
  SRCDIR=. \
  DESTDIR=%{buildroot} \
  datadir=%{_datadir} \
  %{_builddir}/agama/install.sh

%package opensuse
Summary:        Definition of openSUSE products for the Agama installer.

%description opensuse
Definition of openSUSE products (Tumbleweed, Leap, MicroOS and Slowroll) for the Agama installer.

%files opensuse
%doc README.md
%license LICENSE
%dir %{_datadir}/agama
%dir %{_datadir}/agama/products.d
%{_datadir}/agama/products.d/microos.yaml
%{_datadir}/agama/products.d/tumbleweed.yaml
%{_datadir}/agama/products.d/leap_160.yaml
%{_datadir}/agama/products.d/slowroll.yaml
%{_datadir}/agama/products.d/kalpa.yaml

%package sle
Summary:        Definition of SLE products for the Agama installer.

%description sle
SLE-based products definition for Agama installer.
Definition of SLE-based products (e.g., SUSE Linux Enterprise Server) for the Agama installer.

%files sle
%doc README.md
%license LICENSE
%dir %{_datadir}/agama
%dir %{_datadir}/agama/products.d
%{_datadir}/agama/products.d/sles_160.yaml
%{_datadir}/agama/products.d/sles_sap_160.yaml

%changelog
