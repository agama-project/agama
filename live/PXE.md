# Agama Network Installation (PXE)

## Prerequisites

The PXE boot infrastructure should already exist:

- TFTP/DHCP running (usually dnsmasq)
- FTP server running (usually vsftp)

## Setup

Extract the Linux kernel and the initrd from the archive:

```shell
osc getbinaries images x86_64 -M ALP-PXE
tar -C /srv/ftp/image -xf \
    binaries/agama-live.x86_64-5.0.0-ALP-PXE-Build4.1.install.tar

cp /srv/ftp/image/pxeboot.agama-live.x86_64-5.0.0.initrd /srv/tftpboot/boot
cp /srv/ftp/image/pxeboot.agama-live.x86_64-5.0.0.kernel /srv/tftpboot/boot
```

Update the PXE boot configuration in the `/srv/tftpboot/pxelinux.cfg/default`
file:

```
default menu.c32
prompt 0
timeout 120

menu title PXE Menu

label live
    menu label ^Agama
    kernel /boot/pxeboot.agama-live.x86_64-5.0.0.kernel
    append initrd=/boot/pxeboot.agama-live.x86_64-5.0.0.initrd rd.kiwi.install.pxe rd.kiwi.install.image=ftp://X.X.X.X/image/agama-live.x86_64-5.0.0.xz console=ttyS0,115200 rd.kiwi.ramdisk ramdisk_size=2097152
```

## Testing

To test booting Agama in QEMU run these commands:

```shell
qemu-img create mydisk 20g
qemu -boot n -m 4096 -hda mydisk
```
