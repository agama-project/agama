# Using PXE and Iguana

This document explains how to run Agama on PXE with the help of Iguana. The described setup
uses libvirt, but you can adapt the overall approach to other scenarios (like running your TFTP
server).

Additionally, it offers some helpful tips for debugging Agama problems.

## Set up

The process can be summarized in these steps:

1. Set up the TFTP tree, defining a boot option for Agama + Iguana.
2. Configure libvirt network to serve the tree.
3. Prepare the initial ramdisk image (initrd), based on Iguana.
4. Boot from PXE.

### Set up the TFTP tree

The TFTP tree should contain the SYSLINUX boot loader. You can copy the required files from the
`syslinux` package.

    zypper in syslinux
    mkdir /srv/tftpboot
    cp /usr/share/syslinux/pxelinux.0 /srv/tftpboot
    mkdir /srv/tftpboot/pxelinux.cfg

To define a boot option to run Agama, add a `/srv/tftpboot/pxelinux.cfg/default` file with the
following content:

```
default iguana

label iguana
  ipappend 2
  kernel vmlinuz-iguana
  append initrd=initrd-iguana rd.iguana.control_url=tftp://192.168.122.1/agama.yaml rd.iguana.debug=1

display		message
implicit	1
prompt		1
timeout		50
```

Do not worry about the kernel, the initrd or the `agama.yaml` file, we will jump into it
later.

### Configure libvirt to serve TFTP files

To instruct libvirt to serve the TFTP files, you must add the `tftp` and `bootp` elements to the
network configuration. Use the `virsh net-edit default` command to edit the configuration and adapt
it accordingly. Here is an example:

```xml
<network connections='1'>
  <name>default</name>
  <uuid>639e02a7-fcbd-4cf3-a563-6db083aef051</uuid>
  <forward mode='nat'>
    <nat>
      <port start='1024' end='65535'/>
    </nat>
  </forward>
  <bridge name='virbr0' stp='on' delay='0'/>
  <mac address='52:54:00:fb:7c:8e'/>
  <ip address='192.168.122.1' netmask='255.255.255.0'>
    <tftp root='/srv/tftpboot'/>
    <dhcp>
      <range start='192.168.122.2' end='192.168.122.254'/>
      <bootp file='pxelinux.0'/>
    </dhcp>
  </ip>
</network>
```

### Configure VirtualBox to serve TFTP files

If you want to use VirtualBox together with it's built in TFTP support, you have to accept some limitations.

1. Built in TFTP support is available only for NAT network device.
   Such device cannot be used for accessing the guest machine from host system later on. If you plan to access
   the guest over network from host system, you have to use an additional network device - e.g. bridged one.

2. VirtualBox doesn't have particular configuration file / options for setting TFTP. Everything is done via
   hardcoded setup. VirtualBox's internal TFTP server uses `~/.config/VirtualBox/TFTP` (on Linux) for serving
   files. Moreover, to tight particular configuration to specific virtual machine (VM), you have to use VM's
   name in file, subdirectory names, So, if you have VM with name `PXE boot` then PXE kernel is expected to be
   named `PXE boot.pxe`. Similarly, using same naming for kernel and initrd names as above, initrd-iguana is
   expected to be named `PXE initrd-iguana` and kernel `PXE vmlinuz-iguana`. Last but not least the configuration
   directory `pxelinux.0` should be named `PXE pxelinux.0`. To make it clear. Machine name based prefix has to be
   used only in the file names. In the configuration you refer to those files without the prefix - VirtualBox
   adds it transparently for you.

3. VirtualBox's TFTP server is quite limited. You cannot use it for serving custom files like `agama.yaml`.
   You can use another way how to serve d-installer's configuration file. E.g. local http server by changing
   boot option to `rd.iguana.control_url=http://<http-server-ip>/agama.yaml`

4. With this setup Agama listens on port 9090 (See also bellow in Booting from PXE chapter). To be able
   to connect to it you need an additional network device as described in (1). You need to modify
   kernel boot options one more time and add something like `ip=enp0s8:dhcp` where `enp0s8` is second network device.

So, to put everything together. You should have your PXE configuration stored in `~/.config/VirtualBox/TFTP`. You
can use sources and configuration as presented throughout this document with small modification to boot options in
the `default` configuration file. It should look e.g. like this (see point (4) above for details):

`append initrd=initrd-iguana rd.iguana.control_url=http://<http-server-ip>/agama.yaml rd.iguana.debug=1 ip=enp0s8:dhcp`

### initrd preparation

Iguana provides a universal initrd in which actual functionality is implemented in containers. This
ramdisk and its corresponding kernel are included in the [`iguana`
package](https://build.opensuse.org/package/show/home:oholecek:iguana/iguana).

Which containers to use and how to set them up is defined in a *workflow definition*. The [Iguana
repository](https://github.com/openSUSE/iguana) includes a [definition for
Agama](https://github.com/openSUSE/iguana/blob/main/iguana-workflow/examples/agama.yaml).

After installing the `iguana` package, copy the kernel (`/usr/share/iguana/vmlinuz-VERSION`), the
initrd (`/usr/share/iguana/iguana-initrd`) and the workflow definition to the TFTP tree[^1]. You must
use the same paths specified in the `ìguana` boot option (see [Set up the TFTP
tree](#set-up-the-tftp-tree) section).

[^1]: If you want to point always to the latest workflow definition, you can use a raw GitHub
link: `rd.iguana.control_url=https://raw.githubusercontent.com/openSUSE/iguana/main/iguana-workflow/examples/agama.yaml`

### Booting from PXE

To boot from PXE, you just need to set the network card as the first booting device. Alternatively,
you can enable the boot menu so you can decide how to boot your system manually.

Now your virtual machine should be ready to boot from PXE and start Iguana/Agama. Once the
system boots and the services are started, you should be able to access Agama with a browser
on port 9090.

:warning: 4GB RAM is the minimum memory for the virtual machine and using less could affect the
boot proccess.

## Tips

### Adding support for SSH

:warning: **Please, build the initrd on a virtual machine to avoid messing up your system.**

For debugging purposes, you might be interested in connecting to the system and running commands
like `podman` to inspect the situation. If that's the case, you can add SSH support to Iguana's
initrd following these steps:

1. Install [dracut-iguana](https://github.com/openSUSE/iguana/tree/main/dracut-iguana) from
[OBS](https://build.opensuse.org/package/show/home:oholecek:iguana/dracut-iguana).

2. Install the `dracut-sshd` package and place your public SSH key on `/root/.ssh/authorized_keys`.

3. Rebuild the image:

       dracut --verbose --force --no-hostonly --no-hostonly-cmdline --no-hostonly-default-device --no-hostonly-i18n --reproducible --add iguana iguana-initrd

4. Copy the system's kernel (`/boot/vmlinuz-VERSION`) and the generated initrd to your TFTP tree.

### Accessing the serial console

In case of problems, you should inspect system messages. The best way is to enable the serial
console by adding `console=tty0 console=ttyS0,9600` to the `append` line. Then, you will be able to
connect using `sudo virsh console DOMAIN`.
