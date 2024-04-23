# Live ISO

<!-- omit from toc -->
## Table of Content

- [Live ISO](#live-iso)
  - [Layout](#layout)
  - [Building the Sources](#building-the-sources)
  - [Building the ISO Image](#building-the-iso-image)
    - [Build Options](#build-options)
  - [Image Definition](#image-definition)
    - [KIWI Files](#kiwi-files)
  - [Image Configuration](#image-configuration)
    - [SSH Server](#ssh-server)
    - [Autologin](#autologin)
    - [Firefox Profile](#firefox-profile)
    - [Dracut menu](#dracut-menu)
    - [Avahi/mDNS](#avahimdns)
      - [The Default Hostname](#the-default-hostname)
      - [Service Advertisement](#service-advertisement)
    - [The Default Cockpit/Agama TCP Port](#the-default-cockpitagama-tcp-port)
    - [Autoinstallation Support](#autoinstallation-support)
    - [Firmware Cleanup](#firmware-cleanup)

---

## Layout

This directory contains a set of files that are used to build the Agama Live ISO
image.

- [src](src) subdirectory contains all source files which are copied unmodified
  to the OBS project
- [root](root) subdirectory contains files which are added to the Live ISO root
  system (inside the squashfs image)
- [root-ALP-PXE](root-ALP-PXE) subdirectory contains specific files for the ALP
  image used for the PXE boot, see a separate [PXE documentation](PXE.md) for
  more details about the PXE boot
- [config-cdroot](config-cdroot) subdirectory contains file which are copied to
  the uncompressed root of the ISO image, the files can be accessed just by
  mounting the ISO file or the DVD medium

## Building the Sources

To build the sources for OBS just run the

```shell
make
```

command. This will save the built source files into the `dist` subdirectory.

To start from scratch run

```shell
make clean
```

or just simply delete the `dist` subdirectory.

## Building the ISO Image

To build the ISO locally run the

```shell
make build
```

command. The built ISO image is saved to the `/var/tmp/build-root` directory,
see the end of the build for output for the exact ISO file name.

For building an ISO image you need a lot of free space at the `/var` partition.
Make sure there is at least 25GiB free space otherwise the build will
fail.

### Build Options

By default this will build the openSUSE image. If you want to build
another image then run

```shell
make build FLAVOR=<flavor>
# for building the ALP flavor:
make build FLAVOR=ALP
```

See the [_multibuild](src/_multibuild) file for the list of available build
flavors.

By default it will use the [systemsmanagement:Agama:Staging](
https://build.opensuse.org/project/show/systemsmanagement:Agama:Staging) OBS
project. If you want to build using another project, like your fork, then delete
the `dist` directory and checkout the OBS project manually and run the build:

```shell
rm -rf dist
# replace <USER> with your OBS account name
osc co -o dist home:<USER>:branches:systemsmanagement:Agama:Staging agama-live
make build
```

## Image Definition

The [KIWI](https://github.com/OSInside/kiwi) image builder is used by OBS to
build the Live ISO. See the [KIWI documentation](
https://osinside.github.io/kiwi/index.html) for more details about the build
workflow and the `.kiwi` file format.

### KIWI Files

The main Kiwi source files are located in the [src](src) subdirectory:

- [agama-live.kiwi](src/agama-live.kiwi) is the main Kiwi file which drives the
  ISO image build.
- [config.sh](src/config.sh) is a Kiwi hook script which is called and the end
  of the build process, after all packages are installed but before compressing
  and building the image. The script runs in the image chroot and is usually
  used to adjust the system configuration (enable/disable services, patching
  configuration files or deleting not needed files).
- [_constraints](src/_constraints) file tells OBS to build the image on the
  hosts with enough resources (enough free disk space).
- [_multibuild](src/_multibuild) defines the image flavors (Kiwi profiles)
  which are available to build
- [images.sh](src/images.sh) - injects a script which checks whether the machine
  has enough RAM when booting the Live ISO
- [fix_bootconfig](src/fix_bootconfig) - a special Kiwi hook script which sets
  the boot configuration on S390 and PPC64 architectures.

## Image Configuration

The Live ISO is configured to allow using some features and allow running Agama
there.

### SSH Server

The SSH connection for the root user is enabled in the [10_root_login.conf](
root/etc/ssh/sshd_config.d/10_root_login.conf) file.

### Autologin

Automatic root login and staring the graphical environment is configured in
several files.

- [x11-autologin.service](src/etc/systemd/system/x11-autologin.service) uses
  `startx` to start an x11 session.
- `startx` runs the Icewm window manager via [.xinitrc](root/root/.xinitrc)
  file.
- Icewm autostarts Firefox via [startup](root/root/.icewm/startup) file.
- Icewm uses the usual YaST2 installation
  [preferences.yast2](root/etc/icewm/preferences.yast2) configuration file

### Firefox Profile

The default Firefox configuration is defined in the
[profile](root/root/.mozilla/firefox/profile) file. It disables several features
which do not make sense in Live ISO like remembering the used passwords.

### Dracut menu

The [98dracut-menu](live/root/usr/lib/dracut/modules.d/98dracut-menu) directory
implements a simple menu system for dracut. To activate it
during boot add `rd.cmdline=menu` to the boot prompt. This is similar to
`rd.cmdline=ask` which gives you a simple one-line prompt to add boot options.

The dracut-cmdline-menu can currently set the `root` and `proxy` options. The
settings are copied (using a dracut pre-pivot hook) to the live system in
[cmdline-menu.conf](root/etc/cmdline-menu.conf).

There is also the complete command line in the
[cmdline-full.conf](root/etc/cmdline-full.conf) file - maybe it can useful at
least for debugging.

For more details see [dracut.bootup(7)](
https://man.archlinux.org/man/dracut.bootup.7.en),
[dracut-pre-pivot.service(8)](
https://man.archlinux.org/man/extra/dracut/dracut-pre-pivot.service.8.en).

To arrange the dracut config in KIWI you have to adjust the default dracut
config of the live system. This is done in [config.sh](src/config.sh). You can
also fill in a default network location if one is defined for a product
(currently not).

### Avahi/mDNS

The mDNS service allows resolving host names in the local network without
a DNS server. That is implemented by the `avahi-daemon` service which enabled
in the [config.sh](src/config.sh) file and installed in the `avahi` RPM package.

The mDNS protocol resolves the hosts in the `.local` domain.

#### The Default Hostname

By default the Agama live ISO sets the `agama` host name which can be used
as `agama.local` full hostname in URL.

The default hostname is set by the
[agama-hostname](root/etc/systemd/system/agama-hostname.service) service.

If the hostname is set via the `hostname=` boot parameter then the `agama`
host name is not used, the boot option takes precedence.

#### Service Advertisement

The Avahi HTTPS service announcement is configured via the Avahi
[agama.service](root/etc/avahi/services/agama.service) file

That allows scanning all running Agama instances in the local network with
command:

```shell
avahi-browse -t -r _agama._sub._https._tcp
```

### The Default Cockpit/Agama TCP Port

The default Cockpit TCP port is 9090. That makes sense for the system management
framework as the default ports might be used by a running Apache or other web
servers.

But Agama runs from a Live ISO where running a web server does not make much
sense so we can safely use the default HTTP(S) ports.

The default port is changed in the
[listen.conf](root/etc/systemd/system/cockpit.socket.d/listen.conf) file.

### Autoinstallation Support

The autoinstallation is started using the
[agama-auto](root/etc/systemd/system/agama-auto.service) service which starts
the [auto.sh](root/usr/bin/auto.sh) script. This script downloads the
installation profile, applies it to Agama and starts the installation.

### Firmware Cleanup

The [fw_cleanup.rb](root/tmp/fw_cleanup.rb) script removes the unused firmware
from the image. Many firmware files are not needed, this makes the final ISO
much smaller.

This script is started from [config.sh](src/config.sh) the script and after
running it the script deleted. (Not needed anymore in the system.)
