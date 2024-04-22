# Agama ISO Installer

Agama installer is deployed as a regular application which can be installed and run on a local system. However, the most expected way of using Agama is by running it on a live ISO image.

## Sources

The Live ISO sources are maintained in the [live](../live/) subdirectory,
See more details in a [live/README.md](../live/README.md) documentation.

## Live ISO Requirements

A live ISO for running Agama should provide the following software:

* Hardware drivers.
* Agama installer and related tools (lvm, cryptsetup, networkmanager, etc).
* A browser to locally render the Agama web UI.
* Optionally, repository packages of the products to install.

Notes:

* If no browser is included, then the installation has to be remotely performed by using a browser from another machine. This would be the typical case for s390x installations.
* If no repositories are included, then the installation would require internet connection to download the packages of the product to install.

## Agama Live ISO (*only for development and testing*)

The Agama project provides a [live ISO image](https://build.opensuse.org/package/show/systemsmanagement:Agama:Devel/agama-live) for testing purposes and it is intended to be used for developers only. It has some limitations and it is not optimized for production usage.

**Disclaimer: Agama project is focused on develop the Agama installer applications. Generating and optimizing production ready live ISO images for both SUSE and openSUSE projects is out of the scope.**

### Description

* The live ISO is based on openSUSE Tumbleweed.
* Allows installing both SUSE and openSUSE products.
* Weighs around 1 GiB.
* Contains Agama installer and tools, and hardware drivers.
* **Includes Firefox (except for ppc64le and s390x).**
* **Does not include packages from product repositories.**
* Supported archs: x86_64, aarch64, ppc64le and s390x.

Notes:

* Firefox is compiled for [ppc64le in Factory](https://build.opensuse.org/package/show/openSUSE:Factory:PowerPC/MozillaFirefox), but it is not included in the repositories of ALP and openSUSE products.
* Firefox is not compiled for s390x.
* For both ppc64le and s390x a browser from a remote machine has to be used in order to run the Agama web UI. Auto-installation and CLI equally works in all architectures.
* An internet connection is always required to download the packages of the product to install.

### Hardware Requirements

* 2 GiB of RAM memory
* Internet connection to download packages of the product to install.
* Around 10 GiB of disk size, although it depends on the selected product to install.
