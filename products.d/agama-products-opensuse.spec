#
# spec file for package agama-products-opensuse
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

Name:           agama-products-opensuse
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Definition of opensuse products for Agama installer
License:        GPL-2.0-only
Url:            https://github.com/opensuse/agama
BuildArch:      noarch
Source0:        opensuse.yaml
Source1:        ALP-Dolomite.yaml

%description
Products definition for Agama installer. This one is for opensuse products.

%package -n agama-products-ALP-Dolomite
#               This will be set by osc services, that will run after this.
Version:        0
Release:        0
Summary:        Definition of dolomite product for Agama installer
License:        GPL-2.0-only
Url:            https://github.com/opensuse/agama
BuildArch:      noarch

%description -n agama-products-ALP-Dolomite
Products definition for Agama installer. This one is for ALP Dolomite product.

%prep

%build

%install
install -D -d -m 0755 %{buildroot}%{_datadir}/agama/products.d
install -m 0644 %{SOURCE0} %{buildroot}%{_datadir}/agama/products.d
install -m 0644 %{SOURCE1} %{buildroot}%{_datadir}/agama/products.d

%files
%dir %{_datadir}/agama
%dir %{_datadir}/agama/products.d
%{_datadir}/agama/products.d/opensuse.yaml

%files -n agama-products-ALP-Dolomite
%dir %{_datadir}/agama
%dir %{_datadir}/agama/products.d
%{_datadir}/agama/products.d/ALP-Dolomite.yaml

%changelog
