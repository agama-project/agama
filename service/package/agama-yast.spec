# ---------------
# FIXME: SPEC header
# simple approach: most of the files are in the binary gem anyway

Name:           agama-yast
Version:        10.devel155
Release:        0
BuildRequires:  rubygem(agama-yast)
BuildRequires:  dbus-1-common
# "msgfmt" tool
BuildRequires:  gettext-runtime
Requires:       dbus-1-common
Url:            https://github.com/openSUSE/agama
Source1:        po.tar.bz2
Source2:        install_translations.sh
Summary:        YaST integration service for Agama - common files
License:        GPL-2.0-only
Group:          Development/Languages/Ruby

%description
D-Bus service exposing some YaST features that are useful for Agama.

%prep

%build

%install
%define mod_full_name agama-yast-*
install -D -m 0644 %{gem_base}/gems/%{mod_full_name}/share/dbus.conf %{buildroot}%{_datadir}/dbus-1/agama.conf
install --directory %{buildroot}%{_datadir}/dbus-1/agama-services
install -m 0644 --target-directory=%{buildroot}%{_datadir}/dbus-1/agama-services %{gem_base}/gems/%{mod_full_name}/share/org.opensuse.Agama*.service
install -D -m 0644 %{gem_base}/gems/%{mod_full_name}/share/agama.service %{buildroot}%{_unitdir}/agama.service
install -D -m 0644 %{gem_base}/gems/%{mod_full_name}/share/agama-proxy-setup.service %{buildroot}%{_unitdir}/agama-proxy-setup.service
install --directory %{buildroot}/usr/share/agama/conf.d
install -D -m 0644 %{gem_base}/gems/%{mod_full_name}/conf.d/*.yaml %{buildroot}/usr/share/agama/conf.d/

# run a script for installing the translations
sh "%{SOURCE2}" "%{SOURCE1}"


%pre
%service_add_pre agama.service

%post
%service_add_post agama.service

%preun
%service_del_preun agama.service

%postun
%service_del_postun_with_restart agama.service

%files
%{_datadir}/dbus-1/agama.conf
%dir %{_datadir}/dbus-1/agama-services
%{_datadir}/dbus-1/agama-services/org.opensuse.Agama*.service
%{_unitdir}/agama.service
%{_unitdir}/agama-proxy-setup.service
%dir %{_datadir}/agama
%dir %{_datadir}/agama/conf.d
%{_datadir}/agama/conf.d
%dir /usr/share/YaST2
/usr/share/YaST2/locale

%changelog
