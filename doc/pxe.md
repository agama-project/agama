# Using PXE and Iguana

This document explains how to run D-Installer on PXE with the help of Iguana. The described setup
uses libvirt, but you can adapt the overall approach to other scenarios (like running your own
TFTP server).

The process can be summarized in these steps:

1. Set up the TFTP tree, defining a boot option for D-Installer + Iguana.
2. Configure libvirt network to serve the tree.
3. Prepare the initial ramdisk image (initrd), based on Iguana.
4. Boot from PXE.

## Set up the TFTP tree

The TFTP tree should contain the SYSLINUX boot loader. You can copy the required files from the
`syslinux` package.

    zypper in syslinux
    mkdir /srv/tftpboot
    cp /usr/share/syslinux/pxelinux.0 /srv/tftpboot
    mkdir /srv/tftpboot/pxelinux.cfg

To define a boot option to run D-Installer, add a `/srv/tftpboot/pxelinux.cfg/default` file with the
following content:

```
default iguana

label iguana
  ipappend 2
  kernel vmlinuz-iguana
  append initrd=initrd-iguana rd.iguana.control_url=tftp://192.168.122.1/d-installer.yaml rd.iguana.debug=1

display		message
implicit	1
prompt		1
timeout		50
```

Do not worry about the kernel, the initrd or the `d-installer.yaml` file, we will jump into it
later.

## Configure libvirt to server TFTP files

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

## initrd preparation

**Please, build the initrd on a virtual machine to avoid messing up your system.**

Iguana provides a universal initrd in which actual functionality is implemented in containers. Which
containers to use and how to set them up is defined in a *workflow definition*. The [Iguana
repository](https://github.com/openSUSE/iguana) includes a [definition for
D-Installer](https://github.com/openSUSE/iguana/blob/main/iguana-workflow/examples/d-installer.yaml).

In the future, you should be able to get the kernel and the initrd files from the [Iguana
package](https://build.opensuse.org/package/show/home:oholecek:iguana/iguana). However, for
D-Installer to work, we need to do include an `/etc/NetworkManager` directory, so you need to
rebuild the image by now.


1. Install [dracut-iguana](https://github.com/openSUSE/iguana/tree/main/dracut-iguana) from
[OBS](https://build.opensuse.org/package/show/home:oholecek:iguana/dracut-iguana).

2. (Optional) For debugging purposes, you might want to add SSH support so you can connect to the
   system. If that's the case, please install the `dracut-ssh` package and place your public SSH key
   on `/root/.ssh/authorized_keys`.

3. Create a `/etc/NetworkManager` directory to be included in the initrd:

        mkdir -p rd.live.networkmanager/etc/NetworkManager

4. Rebuild the image:

       dracut --verbose --force --no-hostonly --no-hostonly-cmdline --no-hostonly-default-device --no-hostonly-i18n --reproducible --include rd.live.networkmanager / iguana-initrd

5. Copy the kernel (`/boot/vmlinuz-VERSION`), the initrd and the workflow definition to the TFTP
   tree. You must use the same paths specified in the `ìguana` boot option (see [Set up the TFTP
   tree](#set-up-the-tftp-tree) section).

## Booting from PXE

To boot from PXE, you need to enable the boot menu for your VM. You can do it easily by using
`virt-manager` and marking the `Enable boot menu` option in the `Boot options` section of your
virtual machine. Alternatively, you can edit the XML definition (`virsh edit NAME`) and add the `bootmenu`
element to `<os>` section:

```xml
 <os>
   <bootmenu enable='yes'/>
 </os>
```

Now your virtual machine should be ready to boot from PXE and start Iguana/D-Installer. Once the
system boots and the services are started, you should be able to access D-Installer with a browser
on port 9090.
