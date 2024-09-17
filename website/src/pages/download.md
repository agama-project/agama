# Official Agama Live ISO

Agama **is a multi-product installer**. It means that you can install different distributions using
a single medium. In close collaboration with the openSUSE project, the current image allows
installing [openSUSE Tumbleweed](https://www.opensuse.org/#Tumbleweed), [openSUSE Leap 16.0
Alpha](https://www.opensuse.org/#Leap) and [openSUSE Micro OS](https://get.opensuse.org/microos/).

## Download the Agama Live ISO

The first step is to download the ISO image. Please, choose the one that matches your architecture:

* aarch64
[ISO](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.aarch64-openSUSE.iso)
[checksum](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.aarch64-openSUSE.sha256)

* [x86_64
ISO](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.x86_64-openSUSE.iso)
[checksum](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.x86_64-openSUSE.sha256)

* [ppc64le
ISO](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.ppc64le-openSUSE.iso)
[checksum](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.ppc64le-openSUSE.sha256)

* [s390x
ISO](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.s390x-openSUSE.iso)
[checksum](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/agama-installer.s390x-openSUSE.sha256)

:::warning
Organize the links above in a better way.
:::

## Check the ISO (optional)

You might want to check whether the ISO was correctly downloaded. If that's the case, you can
download the checksum file from the previous section and use the
[sha256sum](https://manpages.opensuse.org/Tumbleweed/coreutils-doc/sha256sum.1.en.html) command:

```shell
sha256sum -c agama-installer.x86_64-openSUSE.sha256
```

Obviously, use the checksum that correponds with your architecture.

## Creating a bootable medium

Once you have the ISO, it is time to [create a bootable USB
stick](https://en.opensuse.org/SDB:Live_USB_stick) (recommended) or [burn a
worry, we have you covered:
DVD](https://en.opensuse.org/SDB:Download_help#Using_Linux). If you are not using Linux, do not

## Starting the installation

Starting the system using the bootable medium should take you to the product selection screen.
Please, bear in mind that it may take a few seconds.

![Display the product selection screen with options for installing openSUSE Tumbleweed, Leap and
MicroOS](./img/product-selection.png)

:::tip
The Agama Live ISO allows some customizations during boot (e.g., setting up the network, changing
the `root` password, etc.). Please, check the **boot options** (link) for further information.
:::
