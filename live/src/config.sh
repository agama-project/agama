#! /bin/bash

set -ex

# KIWI functions
test -f /.kconfig && . /.kconfig
test -f /.profile && . /.profile

# greeting
echo "Configure image: [$kiwi_iname]..."

# setup baseproduct link
suseSetupProduct

# enable the corresponding repository
DISTRO=$(grep "^NAME" /etc/os-release | cut -f2 -d\= | tr -d '"' | tr " " "_")
REPO="/etc/zypp/repos.d/agama-${DISTRO}.repo"
if [ -f "${REPO}.disabled" ]; then
  mv "${REPO}.disabled" $REPO
fi
rm /etc/zypp/repos.d/*.disabled

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

# activate services
systemctl enable sshd.service
systemctl enable NetworkManager.service
systemctl enable avahi-daemon.service
systemctl enable agama.service
systemctl enable agama-web-server.service
systemctl enable agama-dbus-monitor.service
systemctl enable agama-auto.service
systemctl enable agama-hostname.service
systemctl enable agama-proxy-setup.service
systemctl enable agama-certificate-issue.path
systemctl enable agama-certificate-wait.service
systemctl enable agama-cmdline-process.service
systemctl enable agama-welcome-issue.service
systemctl enable agama-avahi-issue.service
systemctl enable agama-url-issue.service
systemctl enable agama-ssh-issue.service
systemctl enable agama-self-update.service
systemctl enable live-free-space.service
systemctl enable live-password.service
systemctl enable live-root-shell.service
systemctl enable checkmedia.service
systemctl enable qemu-guest-agent.service
systemctl enable setup-systemd-proxy-env.path
systemctl enable x11-autologin.service
systemctl enable spice-vdagentd.service
systemctl enable zramswap

# default target
systemctl set-default graphical.target

# disable snapshot cleanup
systemctl disable snapper-cleanup.timer
systemctl disable snapper-timeline.timer

# disable unused services
systemctl disable YaST2-Firstboot.service
systemctl disable YaST2-Second-Stage.service

### setup dracut for live system
arch=$(uname -m)
# keep in sync with ISO Volume ID set in the fix_bootconfig script
profile=$(echo "$kiwi_profiles" | tr "_" "-")
label="Install-$profile-$arch"

echo "Setting default live root: live:LABEL=$label"
mkdir /etc/cmdline.d
echo "root=live:LABEL=$label" >/etc/cmdline.d/10-liveroot.conf
echo "root_disk=live:LABEL=$label" >>/etc/cmdline.d/10-liveroot.conf
# if there's a default network location, add it here
# echo "root_net=" >> /etc/cmdline.d/10-liveroot.conf
echo 'install_items+=" /etc/cmdline.d/10-liveroot.conf "' >/etc/dracut.conf.d/10-liveroot-file.conf
echo 'add_dracutmodules+=" dracut-menu agama-cmdline "' >>/etc/dracut.conf.d/10-liveroot-file.conf

# decrease the kernel logging on the console, use a dracut module to do it early in the boot process
echo 'add_dracutmodules+=" agama-logging "' > /etc/dracut.conf.d/10-agama-logging.conf

# add xhci-pci-renesas to initrd if available (workaround for bsc#1237235)
# FIXME: remove when the module is included in the default driver list in
# in /usr/lib/dracut/modules.d/90kernel-modules/module-setup.sh, see
# https://github.com/openSUSE/dracut/blob/7559201e7480a65b0da050263d96a1cd8f15f50d/modules.d/90kernel-modules/module-setup.sh#L42-L46
if [ -f /lib/modules/*/kernel/drivers/usb/host/xhci-pci-renesas.ko* ]; then
  echo "Adding xhci-pci-renesas driver to initrd..."
  echo 'add_drivers+=" xhci-pci-renesas "' > /etc/dracut.conf.d/10-extra-drivers.conf
fi

if [ "${arch}" = "s390x" ]; then
  # workaround for custom bootloader setting
  touch /config.bootoptions
fi

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

# Clean-up logs
rm /var/log/zypper.log /var/log/zypp/history

# reduce the "vim-data" content, this package is huge (37MB unpacked!), keep only
# support for JSON (for "agama config edit") and Ruby (fixing/debugging the Ruby
# service)
rpm -ql vim-data | grep -v -e '/ruby.vim$' -e '/json.vim$' -e colors | xargs rm 2>/dev/null || true

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

# delete translations and unusupported languages (makes ISO about 22MiB smaller)
# build list of ignore options for "ls" with supported languages like "-I cs* -I de* -I es* ..."
readarray -t IGNORE_OPTS < <(ls /usr/share/agama/web_ui/po.*.js.gz | sed -e "s#/usr/share/agama/web_ui/po\.\(.*\)\.js\.gz#-I\n\\1*#")
# additionally keep the en_US translations
ls -1 "${IGNORE_OPTS[@]}" -I en_US /usr/share/locale/ | xargs -I% sh -c "echo 'Removing translations %...' && rm -rf /usr/share/locale/%"

# delete locale definitions for unsupported languages (explicitly keep the C and en_US locales)
ls -1 "${IGNORE_OPTS[@]}" -I "en_US*" -I "C.*" /usr/lib/locale/ | xargs -I% sh -c "echo 'Removing locale %...' && rm -rf /usr/lib/locale/%"

# delete unused translations (MO files)
for t in zypper gettext-runtime p11-kit; do
  rm -f /usr/share/locale/*/LC_MESSAGES/$t.mo
done
du -h -s /usr/{share,lib}/locale/

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
  python_deps=$(echo "$python_deps" | grep -v -e "Failed dependencies" -e "needed by .* libpython" -e "needed by .* bcache-tools" -e "needed by .* xfsprogs" || true)

  if [ -z "$python_deps"]; then
    echo "Removing Python..."
    # remove libpython as well
    rpm -e --nodeps "$python" $(rpm -qa | grep "^libpython3")
  else
    echo "Warning: Extra Python dependency detected:"
    echo "$python_deps"
    echo "Keeping the python packages installed"
  fi
fi

# remove OpenGL support
rpm -qa | grep ^Mesa | xargs rpm -e --nodeps

# uninstall libyui-qt and libqt (pulled in by the YaST dependencies),
# not present in SLES, do not fail if not installed
if rpm -q --whatprovides libyui-qt libyui-qt-pkg > /dev/null; then
  rpm -q --whatprovides libyui-qt libyui-qt-pkg | xargs rpm -e --nodeps
fi
rpm -qa | grep ^libQt | xargs --no-run-if-empty rpm -e --nodeps

## removing drivers and firmware makes the Live ISO about 370MiB smaller
#
# Agama does not use sound, added by icewm dependencies
rpm -e --nodeps alsa alsa-utils alsa-ucm-conf || true

# driver and firmware cleanup
# Note: openSUSE Tumbleweed Live completely removes firmware for some server
# network cars, because you very likely won't run TW KDE Live on a server.
# But for Agama installer it makes more sense to run on server. So we keep it
# and remove the drivers for sound cards and TV cards instead. Those do not
# make sense on a server.
du -h -s /lib/modules /lib/firmware

# remove the multimedia drivers
# set DEBUG=1 to print the deleted drivers
/tmp/driver_cleanup.rb --delete
# remove the script and data, not needed anymore
rm /tmp/driver_cleanup.rb /tmp/module.list*

# remove the unused firmware (not referenced by kernel drivers)
/tmp/fw_cleanup.rb --delete
# remove the script, not needed anymore
rm /tmp/fw_cleanup.rb
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

# delete some AMD GPU firmware
rm -rf /lib/firmware/amdgpu/{gc_,isp,psp}*

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

# Only used for OpenCL and X11 acceleration on vmwgfx (?), saves ~50MiB
rpm -e --nodeps Mesa-gallium || true
# Too big and will have to be dropped anyway (unmaintained, known security issues)
rm -rf /usr/lib*/libmfxhw*.so.* /usr/lib*/mfx/

# the new, optional nvidia gsp firmware blobs are huge - ~ 70MB
du -h -s /lib/firmware/nvidia
find /lib/firmware/nvidia -name gsp | xargs -r rm -rf
du -h -s /lib/firmware/nvidia
# The gems are unpackaged already, no need to store them twice
du -h -s /usr/lib*/ruby/gems/*/cache/
rm -rf /usr/lib*/ruby/gems/*/cache/

# Not needed, boo#1166406
rm -f /boot/vmlinux*.[gx]z
rm -f /lib/modules/*/vmlinux*.[gx]z

# Remove generated files (boo#1098535)
rm -rf /var/cache/zypp/* /var/lib/zypp/AnonymousUniqueId /var/lib/systemd/random-seed
