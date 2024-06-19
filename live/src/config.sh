#! /bin/bash

set -ex

# KIWI functions
test -f /.kconfig && . /.kconfig
test -f /.profile && . /.profile

# greeting
echo "Configure image: [$kiwi_iname]..."

# setup baseproduct link
suseSetupProduct

# configure the repositories in the Live system
# import the OBS key for the systemsmanagement OBS project
rpm --import /tmp/systemsmanagement_key.gpg
rm /tmp/systemsmanagement_key.gpg
# import the openSUSE keys
rpm --import /usr/lib/rpm/gnupg/keys/*.asc

# activate services
systemctl enable sshd.service
systemctl enable NetworkManager.service
systemctl enable avahi-daemon.service
systemctl enable agama.service
systemctl enable agama-web-server.service
systemctl enable agama-auto.service
systemctl enable agama-hostname.service
systemctl enable agama-proxy-setup.service
systemctl enable agama-certificate-issue.path
systemctl enable agama-certificate-wait.service
systemctl enable agama-welcome-issue.service
systemctl enable agama-avahi-issue.service
systemctl enable agama-ssh-issue.service
systemctl enable agama-self-update.service
systemctl enable live-password-cmdline.service
systemctl enable live-password-dialog.service
systemctl enable live-password-iso.service
systemctl enable live-password-random.service
systemctl enable live-password-systemd.service
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
label=${kiwi_install_volid:-$kiwi_iname}
arch=$(uname -m)

echo "Setting default live root: live:LABEL=$label"
mkdir /etc/cmdline.d
echo "root=live:LABEL=$label" >/etc/cmdline.d/10-liveroot.conf
echo "root_disk=live:LABEL=$label" >>/etc/cmdline.d/10-liveroot.conf
# if there's a default network location, add it here
# echo "root_net=" >> /etc/cmdline.d/10-liveroot.conf
echo 'install_items+=" /etc/cmdline.d/10-liveroot.conf "' >/etc/dracut.conf.d/10-liveroot-file.conf
echo 'add_dracutmodules+=" dracut-menu "' >>/etc/dracut.conf.d/10-liveroot-file.conf

if [ "${arch}" = "s390x" ];then
    # workaround for custom bootloader setting
    touch /config.bootoptions
fi

# replace the @@LIVE_MEDIUM_LABEL@@ with the real Live partition label name from KIWI
sed -i -e "s/@@LIVE_MEDIUM_LABEL@@/$label/g" /usr/bin/live-password

################################################################################
# Reducing the used space

# Clean-up logs
rm /var/log/zypper.log /var/log/zypp/history

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
ls -1 -d /usr/lib/locale/*.utf8 | sed -e "s#/usr/lib/locale/##" -e "s#utf8#UTF-8#" > /etc/agama.d/locales

# delete translations and unusupported languages (makes ISO about 22MiB smaller)
# build list of ignore options for "ls" with supported languages like "-I cs* -I de* -I es* ..."
readarray -t IGNORE_OPTS < <(ls /usr/share/agama/web_ui/po.*.js.gz | sed -e "s#/usr/share/agama/web_ui/po\.\(.*\)\.js\.gz#-I\n\\1*#")
# additionally keep the en_US translations
ls -1 "${IGNORE_OPTS[@]}" -I en_US /usr/share/locale/ | xargs -I% sh -c "echo 'Removing translations %...' && rm -rf /usr/share/locale/%"

# delete locale definitions for unsupported languages (explicitly keep the C and en_US locales)
ls -1 "${IGNORE_OPTS[@]}" -I "en_US*" -I "C.*" /usr/lib/locale/ | xargs -I% sh -c "echo 'Removing locale %...' && rm -rf /usr/lib/locale/%"

# delete unused translations (MO files)
for t in zypper gettext-runtime p11-kit; do
    rm /usr/share/locale/*/LC_MESSAGES/$t.mo
done
du -h -s /usr/{share,lib}/locale/

# remove documentation
du -h -s /usr/share/doc/packages/
rm -rf /usr/share/doc/packages/*
# remove man pages
du -h -s /usr/share/man
rm -rf /usr/share/man/*

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
# delete sound drivers
rm -rfv /lib/modules/*/kernel/sound
# delete TV cards and radio cards
rm -rfv /lib/modules/*/kernel/drivers/media/

# remove the unused firmware (not referenced by kernel drivers)
/tmp/fw_cleanup.rb --delete
# remove the script, not needed anymore
rm /tmp/fw_cleanup.rb
du -h -s /lib/modules /lib/firmware

################################################################################
# The rest of the file was copied from the openSUSE Tumbleweed Live ISO
# https://build.opensuse.org/package/view_file/openSUSE:Factory:Live/livecd-tumbleweed-kde/config.sh?expand=1
#

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
