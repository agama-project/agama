# Autoinstallation Support for D-Installer

## Introduction

There is always a need for an automatic installation mechanism to support unattended and
reproducible mass deployments. D-Installer tries to offer different options to fit user needs.
Basically, we have identified these approaches:

* Use a definition which contains the options to use. This definition could be dynamically adjusted
  based on conditions like hardware, network location, and so on.
* Offer a mechanism (like a CLI) to allow the user find its own way, tweaking the process as much as
  needed.

## Activation

Auto-installation is activated by using `dinst.auto=<url>` on kernel command line. It can handle
three different file formats: JSON, Jsonnet and a plain shell script. So let's describe how they are
handled.

## Supported formats

### JSON/Jsonnet

The user can use JSON or Jsonnet (in case that the profile should be adjusted dynamically) to
specify the configuration. You can find some [examples in the CLI
repository](https://github.com/yast/d-installer-cli/tree/main/dinstaller-lib/share/examples). The
JSON representation can be easily obtained by running: `dinstaller config show`.

When this kind of files are provided through the `dinst.auto` parameter, D-Installer fetches,
validates and processes the file.

### Shell Script

A shell script basically gives the user full control. It is expected to use the CLI to interact with
D-Installer, but the user can rely on any other tool available in the installation media. So e.g. if
user needs to fix a degraded RAID first and then run the probing process again, it is possible.
Below there is a minimal working example to install Tumbleweed:

```sh
set -ex

/usr/bin/dinstaller config set software.product=Tumbleweed
/usr/bin/dinstaller config set user.userName=joe user.password=doe
/usr/bin/dinstaller install
```

When a shell script is provided through the `dinst.auto` parameter, D-Installer fetches and runs the
script.
