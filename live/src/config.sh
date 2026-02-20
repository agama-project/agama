#!/bin/bash

set -ex

# KIWI functions
test -f /.kconfig && . /.kconfig
test -f /.profile && . /.profile

# greeting
echo "Configure image: [$kiwi_iname]..."

# setup baseproduct link
suseSetupProduct

# save the current build data, the %VARIABLES% are replaced by the OBS
# kiwi_metainfo_helper service before starting the build
mkdir -p /var/log/build
cat << EOF > /var/log/build/info
Build date:    $(LC_ALL=C date -u -d "@${SOURCE_DATE_EPOCH:-$(date +%s)}" "+%F %T %Z")
Build number:  Build%RELEASE%
Image profile: $kiwi_profiles
Image version: $kiwi_iversion
Image type:    $kiwi_type
Source URL:    %SOURCEURL%
EOF

# for reproducible builds:
echo -n > /var/log/alternatives.log
sed -i 's/# AutoInstalled generated.*/# AutoInstalled generated in kiwi reproducible build/' /var/lib/zypp/AutoInstalled # drop timestamp
rm -f /var/tmp/rpm-tmp.*

# enable the corresponding repository
DISTRO=$(grep "^NAME" /etc/os-release | cut -f2 -d\= | tr -d '"' | tr " " "_")
REPO="/etc/zypp/repos.d/agama-${DISTRO}.repo"
if [ -f "${REPO}.disabled" ]; then
  mv "${REPO}.disabled" $REPO
fi
rm -f /etc/zypp/repos.d/*.disabled

# configure the repositories in the Live system
# import the OBS key for the systemsmanagement OBS project
rpm --import /tmp/systemsmanagement_key.gpg
rm /tmp/systemsmanagement_key.gpg
# import the IBS key for the Devel:YaST:Agama:Head project
rpm --import /tmp/Devel_YaST_Agama_Head_key.gpg
rm /tmp/Devel_YaST_Agama_Head_key.gpg
# import the openSUSE keys, but check if there is any
if stat -t /usr/lib/rpm/gnupg/keys/*.asc 2>/dev/null 1>/dev/null; then
  rpm --import /usr/lib/rpm/gnupg/keys/*.asc
fi

if [ $(rpm -q --provides libzypp | grep -q 'libzypp(econf)'; echo $?) -eq 0 ]; then
# A new enough version of libzypp is in use which supports UAPI configuration. Configure a drop-in conf
cat <<EOF > /etc/zypp/zypp.conf.d/90-agama.conf
[main]
download.connect_timeout = 20
EOF
else
# decrease the libzypp timeout to 20 seconds (the default is 60 seconds)
sed -i -e "s/^\s*#\s*download.connect_timeout\s*=\s*.*$/download.connect_timeout = 20/" /etc/zypp/zypp.conf
fi

# activate services
systemctl enable sshd.service
systemctl enable NetworkManager.service
systemctl enable avahi-daemon.service
systemctl enable agama.service
systemctl enable agama-web-server.service
systemctl enable agama-dbus-monitor.service
systemctl enable agama-autoinstall.service
systemctl enable agama-hostname.service
systemctl enable agama-proxy-setup.service
systemctl enable agama-certificate-issue.path
systemctl enable agama-certificate-wait.service
systemctl enable agama-cmdline-process.service
systemctl enable agama-welcome-issue.service
systemctl enable agama-avahi-issue.service
systemctl enable agama-url-issue.service
systemctl enable agama-ssh-issue.service
systemctl enable live-free-space.service
systemctl enable live-password.service
systemctl enable live-root-shell.service

# the self-update actually runs in the initramfs system, but the exit status
# is lost if it is not enabled in the root image as well,
# it runs only once in the initramfs because of "WantedBy=initrd.target"
systemctl enable live-self-update.service

systemctl enable checkmedia.service
systemctl enable qemu-guest-agent.service
systemctl enable setup-systemd-proxy-env.path
test -f /usr/lib/systemd/system/gdm.service && systemctl enable gdm.service
test -f /usr/lib/systemd/system/spice-vdagentd.service && systemctl enable spice-vdagentd.service
systemctl enable zramswap

# set the default target
if [[ "$kiwi_profiles" == *MINI* ]]; then
  # the MINI images do not include graphical environment
  systemctl set-default multi-user.target
else
  systemctl set-default graphical.target
fi

# disable snapshot cleanup
systemctl disable snapper-cleanup.timer
systemctl disable snapper-timeline.timer

# disable unused services
systemctl disable YaST2-Firstboot.service
systemctl disable YaST2-Second-Stage.service

# Prevent premature activation of LVM (bsc#1246133)
systemctl mask lvm2-monitor.service
sed -i 's:# event_activation = 1:event_activation = 0:' /etc/lvm/lvm.conf

# Prevent premature assembly of MD RAIDs (bsc#1245159)
touch /etc/udev/rules.d/64-md-raid-assembly.rules

# the "eurlatgr" is the default font for the English locale
echo -e "\nFONT=eurlatgr.psfu" >> /etc/vconsole.conf

# configure self-update in SLES
if [[ "$kiwi_profiles" == *SLE* ]]; then
  echo "Configuring the installer self-update..."
  # read the self-update configuration variables
  . /usr/lib/live-self-update/conf.sh
  mkdir -p  "$CONFIG_DIR"
  # the default registration server (SCC) if RMT is not set
  echo "https://scc.suse.com" > "$CONFIG_DEFAULT_REG_SERVER_FILE"
  # fallback URL when contacting SCC/RMT fails or no self-update is returned
  echo 'https://installer-updates.suse.com/SUSE/Products/SLE-INSTALLER/$os_release_version_id/$arch/product/' > "$CONFIG_FALLBACK_FILE"
fi

### setup dracut for live system
arch=$(uname -m)
# keep in sync with ISO Volume ID set in the fix_bootconfig script
profile=$(echo "$kiwi_profiles" | tr "_" "-")
label="Install-$profile-$arch"

echo "Setting default live root: live:LABEL=$label"
mkdir /etc/cmdline.d
echo "root=live:LABEL=$label" >/etc/cmdline.d/10-liveroot.conf
echo "root_disk=live:LABEL=$label" >>/etc/cmdline.d/10-liveroot.conf
echo 'install_items+=" /etc/cmdline.d/10-liveroot.conf "' >/etc/dracut.conf.d/10-liveroot-file.conf
echo 'add_dracutmodules+=" dracut-menu agama-cmdline agama-dud live-self-update initrd-nmtui "' >>/etc/dracut.conf.d/10-liveroot-file.conf

# decrease the kernel logging on the console, use a dracut module to do it early in the boot process
echo 'add_dracutmodules+=" agama-logging "' > /etc/dracut.conf.d/10-agama-logging.conf

# add the ipmi drivers to the initrd (bsc#1237354)
extra_drivers=(acpi_ipmi ipmi_devintf ipmi_poweroff ipmi_si ipmi_ssif ipmi_watchdog)

for driver in "${extra_drivers[@]}"
do
  # check if the driver is present (allow a suffix like .zstd or .xz for optionally compressed drivers)
  if find /lib/modules -type f -name "$driver.ko*" -print0 | grep -qz .; then
    echo "Adding $driver driver to initrd..."
    echo "add_drivers+=\" $driver \"" >> /etc/dracut.conf.d/10-extra-drivers.conf
  else
    echo "Skipping driver $driver, not found in the system"
  fi
done

if [ "${arch}" = "s390x" ]; then
  # workaround for custom bootloader setting
  touch /config.bootoptions
fi

# Remove nvme hostid and hostnqn (bsc#1238038)
rm -f /etc/nvme/host*

# Remove default iSCSI initiator name (bsc#1246280)
rm -f /etc/iscsi/initiatorname.iscsi

# replace the @@LIVE_MEDIUM_LABEL@@ with the real Live partition label name from KIWI
sed -i -e "s/@@LIVE_MEDIUM_LABEL@@/$label/g" /usr/bin/live-password
sed -i -e "s/@@LIVE_MEDIUM_LABEL@@/$label/g" /usr/bin/checkmedia-service

# Increase the Live ISO image size to have some extra free space for installing
# additional debugging or development packages.
#
# Unfortunately Kiwi does not allow to configure the image size for the "iso"
# build target (it can do  that for "oem"). As a workaround here we create a big
# sparse file which in reality takes just little space in the image but Kiwi
# uses its virtual size for estimating the needed filesystem size.
# The file is later deleted at boot by the live-free-space service.
dd bs=1 count=1 seek=2G if=/dev/zero of=/var/lib/live_free_space

################################################################################
# Reducing the used space
#
# Profile specific cleanup
#

# Extra cleanup for the MINI images
if [[ "$kiwi_profiles" == *MINI* ]]; then
  # remove the GPU drivers, not needed when running in text mode only,
  # the related firmware is deleted by the script below
  rm -rf /usr/lib/modules/*/kernel/drivers/gpu

  # remove WiFi drivers
  rm -rf /usr/lib/modules/*/kernel/drivers/net/wireless
  # remove Bluetooth drivers
  rm -rf /usr/lib/modules/*/kernel/drivers/bluetooth
  rm -rf /usr/lib/modules/*/kernel/net/bluetooth
fi

# Remove the SUSEConnect CLI tool from the openSUSE images and the mini PXE
# image, keep it in the SLE images, it might be useful for testing/debugging
# (Agama uses libsuseconnect.so directly and does not need the CLI, registration
# in theory would be still possible even in the openSUSE images)
if [[ "$kiwi_profiles" == *MINI* ]] || [[ "$kiwi_profiles" == *Leap* ]] || [[ "$kiwi_profiles" == *openSUSE* ]]; then
  rm -f /usr/bin/suseconnect
fi

################################################################################
# Generic cleanup in all images

# Clean-up logs
rm /var/log/zypper.log /var/log/zypp/history

# reduce the "vim-data" content, this package is huge (37MB unpacked!), keep
# only support for JSON (for "agama config edit"), YAML (the product definition
# files) and Ruby (fixing/debugging the Ruby service)
rpm -ql vim-data | grep -v -e '/ruby.vim$' -e '/json.vim$' -e '/yaml.vim$' -e '/bash.vim$' -e colors | xargs rm 2>/dev/null || true

du -h -s /usr/{share,lib}/locale/

# Agama expects that the same locales available in the installation system can
# be also used later in the installed system and offers them in the web UI to
# select. But to make the Live ISO smaller it makes sense to delete the locales
# not supported by Agama itself. To solve this problem the list of available
# locales is saved to a file before deleting the locales not supported by Agama.
# Agama then reads this file instead of running the "localectl list-locales"
# command.
mkdir -p /etc/agama.d
# emulate "localectl list-locales" call, it cannot be used here because it
# insists on running systemd as PID 1 :-/
ls -1 -d /usr/lib/locale/*.utf8 | sed -e "s#/usr/lib/locale/##" -e "s#utf8#UTF-8#" >/etc/agama.d/locales

# delete translations and unsupported languages (makes ISO about 22MiB smaller)
# build list of ignore options for "ls" with supported languages like "-I cs -I cs_CZ ..."
# languages.json is like: { "ca-ES": "Català", "de-DE": "Deutsch", ...}
# jq prints ca-ES\nde-DE\n...
readarray -t IGNORE_OPTS < <(jq -r keys[] < /usr/share/agama/web_ui/languages.json | sed -e "s/\(.*\)-\(.*\)/-I\n\\1\n-I\n\1_\2/")
# additionally keep the en_US translations
ls -1 "${IGNORE_OPTS[@]}" -I en_US /usr/share/locale/ | xargs -I% sh -c "echo 'Removing translations %...' && rm -rf /usr/share/locale/%"

# delete locale definitions for unsupported languages (explicitly keep the C and en_US locales)
readarray -t IGNORE_OPTS < <(jq -r keys[] < /usr/share/agama/web_ui/languages.json | sed -e "s/-/_/" -e "s/$/.utf8/" -e "s/^/-I\n/")
ls -1 "${IGNORE_OPTS[@]}" -I "en_US.utf8" -I "C.utf8" /usr/lib/locale/ | xargs -I% sh -c "echo 'Removing locale %...' && rm -rf /usr/lib/locale/%"

# delete unused translations (MO files)
for t in zypper gettext-runtime p11-kit; do
  rm -f /usr/share/locale/*/LC_MESSAGES/$t.mo
done
du -h -s /usr/{share,lib}/locale/

# remove printing support from GTK
rm -rf /usr/lib64/gtk-3*/*/printbackends
rpm -e --nodeps libcups2 cups-config || true

# remove documentation
du -h -s /usr/share/doc/packages/
rm -rf /usr/share/doc/packages/*
# remove man pages
du -h -s /usr/share/man
rm -rf /usr/share/man/*

# python is installed just because of few simple scripts /usr/sbin/bcache-status (bcache-tools package)
# and /usr/sbin/xfs_protofile (xfsprogs package)
# both are not used by libtorage-ng, yast2-storage-ng nor agama
python=$(rpm -q --whatprovides python3-base || true)
if [ -n "$python" ]; then
  echo "Python package: $python"
  python_deps=$(rpm -e "$python" 2>&1 || true)
  # avoid removing python accidentally because of some new unknown dependency
  python_deps=$(echo "$python_deps" | grep -v -e "Failed dependencies" -e "needed by .* libpython" \
    -e "needed by .* bcache-tools" -e "needed by .* xfsprogs" -e "needed by .* hyper-v" \
    -e "needed by .* malcontent" -e "needed by .* gnome-shell" || true)

  if [ -z "$python_deps" ]; then
    echo "Removing Python..."
    # remove libpython as well
    rpm -e --nodeps "$python" $(rpm -qa | grep "^libpython3")
  else
    echo "Warning: Extra Python dependency detected:"
    echo "$python_deps"
    echo "Keeping the python packages installed"
  fi
fi

# remove unused SUSEConnect libzypp plugins
rm -f /usr/lib/zypper/commands/zypper-migration
rm -f /usr/lib/zypper/commands/zypper-search-packages

# delete some FireFox audio codec support
rm -f /usr/lib64/firefox/libmozavcodec.so

# uninstall the libyui packages (pulled in by the YaST dependencies),
# not present in SLES, do not fail if not installed
if rpm -q --whatprovides libyui-ncurses libyui-qt libyui-qt-pkg > /dev/null; then
   rpm -q --whatprovides libyui-ncurses libyui-qt libyui-qt-pkg | xargs rpm -e --nodeps
fi
rpm -qa | grep ^libQt | xargs --no-run-if-empty rpm -e --nodeps

## removing drivers and firmware makes the Live ISO about 370MiB smaller
#
# Agama does not use sound, added by icewm dependencies
rpm -e --nodeps alsa alsa-utils alsa-ucm-conf || true

# Delete additional unused packages to decrease the image size
delete_packages=(
  dconf libdconf1
  iso-codes
  gtk4-tools
  gnome-control-center
  gnome-themes-accessibility
  gweather4-data
  libavcodec61
  libvpx11
  libavutil59
  librav1e0_8
)

for package in "${delete_packages[@]}"
do
  rpm -e --nodeps "$package" || true
done

# remove gstreamer and libraries
rpm -qa | grep -e ^libgst -e ^gstreamer | xargs --no-run-if-empty rpm -e --nodeps

# remove some big files
rm -f /usr/bin/jsonnet-lint
rm -f /usr/lib64/firefox/crashreporter

# driver and firmware cleanup
# Note: openSUSE Tumbleweed Live completely removes firmware for some server
# network cars, because you very likely won't run TW KDE Live on a server.
# But for Agama installer it makes more sense to run on server. So we keep it
# and remove the drivers for sound cards and TV cards instead. Those do not
# make sense on a server.
du -h -s /lib/modules /lib/firmware

# remove the multimedia drivers, use the default configuration files
image-janitor -v driver-cleanup --delete --config-files /usr/share/image-janitor/module.list,/usr/share/image-janitor/module.list.extra

# remove the unused firmware(not referenced by kernel drivers)
image-janitor -v fw-cleanup --delete 

# remove the tool, not needed anymore
rpm -e image-janitor
du -h -s /lib/modules /lib/firmware

################################################################################
# The rest of the file was copied from the openSUSE Tumbleweed Live ISO
# https://build.opensuse.org/projects/openSUSE:Factory:Live/packages/livecd-tumbleweed-kde/files/config.sh?expand=1
#

# Stronger compression for the initrd
echo 'compress="xz -9 --check=crc32 --memlimit-compress=50%"' >> /etc/dracut.conf.d/less-storage.conf

# Kernel modules (+ firmware) for X13s
if [ "$(arch)" == "aarch64" ]; then
	echo 'add_drivers+=" clk-rpmh dispcc-sc8280xp gcc-sc8280xp gpucc-sc8280xp nvmem_qcom-spmi-sdam qcom_hwspinlock qcom_q6v5 qcom_q6v5_pas qnoc-sc8280xp pmic_glink pmic_glink_altmode smp2p spmi-pmic-arb leds-qcom-lpg "'  > /etc/dracut.conf.d/x13s_modules.conf
	echo 'add_drivers+=" nvme phy_qcom_qmp_pcie pcie-qcom-ep i2c_hid_of i2c_qcom_geni leds-qcom-lpg pwm_bl qrtr pmic_glink_altmode gpio_sbu_mux phy_qcom_qmp_combo panel-edp msm phy_qcom_edp "' >> /etc/dracut.conf.d/x13s_modules.conf
	echo 'install_items+=" /lib/firmware/qcom/sc8280xp/LENOVO/21BX/qcadsp8280.mbn.xz /lib/firmware/qcom/sc8280xp/LENOVO/21BX/qccdsp8280.mbn.xz "' >> /etc/dracut.conf.d/x13s_modules.conf
fi

# Decompress kernel modules, better for squashfs (boo#1192457)
find /lib/modules/*/kernel -name '*.ko.xz' -exec xz -d {} +
find /lib/modules/*/kernel -name '*.ko.zst' -exec zstd --rm -d {} +
for moddir in /lib/modules/*; do
  depmod "$(basename "$moddir")"
done

# Reuse what the macro does
rpm --eval "%fdupes /usr/share/licenses" | sh

# disable the services included by dependencies
for s in purge-kernels; do
  systemctl -f disable $s || true
done

# Too big and will have to be dropped anyway (unmaintained, known security issues)
rm -rf /usr/lib*/libmfxhw*.so.* /usr/lib*/mfx/

# the new, optional nvidia gsp firmware blobs are huge - ~ 70MB
if [ -e /lib/firmware/nvidia ]; then
  du -h -s /lib/firmware/nvidia
  find /lib/firmware/nvidia -name gsp | xargs -r rm -rf
  du -h -s /lib/firmware/nvidia
fi

# The gems are unpackaged already, no need to store them twice
du -h -s /usr/lib*/ruby/gems/*/cache/
rm -rf /usr/lib*/ruby/gems/*/cache/

# Not needed, boo#1166406
rm -f /boot/vmlinux*.[gx]z
rm -f /lib/modules/*/vmlinux*.[gx]z

# Remove generated files (boo#1098535)
rm -rf /var/cache/zypp/* /var/lib/zypp/AnonymousUniqueId /var/lib/systemd/random-seed

# gnome-kiosk startup script, executable rights not preserved during copying
chmod +x /root/.local/bin/gnome-kiosk-script
