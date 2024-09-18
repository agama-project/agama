---
sidebar_position: 5
---

# Boot options

Agama Live ISO behavior can be altered using the kernel command line at boot time. For those
architectures that support Grub, you need to modify the `agama-installer` entry adding the boot
options at the end of the `linux` line.

:::note It may be easier
We must admit that it is not as convenient as it was when using Linuxrc and YaST. However, we rely
on [dracut](https://manpages.opensuse.org/Tumbleweed/dracut/dracut.8.en.html) now that it is easier
to extend.
:::

- `agama.auto`:
  Tells the installer to use the profile in the given URL to start an unattended installation.

  ```text
  agama.auto=http://mydomain.org/tumbleweed.jsonnet

  ```

- `agama.config_url`: it uses the file at the given URL as the new Agama configuration. Please, do
  not confuse this file with an unattended installation profile. See [URL handling in the
  installer](https://github.com/yast/yast-installation/blob/master/doc/url.md) to find more details
  about the supported URLs.

  ```text
  agama.config_url=http://192.168.122.1/my-agama.yaml
  agama.config_url=usb:///agama.yaml
  ```

- `agama.install_url`
  Override the default `installation_url` set in the product files
  [here](https://github.com/openSUSE/agama/tree/master/products.d) by passing the `agama.install_url`
  parameter as a boot option in the bootloader. This is particularly useful for any pre-production
  testing in openQA.

  ```text
  agama.install_url=https://myrepo,https://myrepo2
  ```

  :::warning
  Setting this variable will impact all products.
  :::

- `proxy`: sets up a network proxy. The supported proxy URL format is `protocol://[user[:password]@]host[:port]`.

  ```text
  proxy=http://192.168.122.1:3128
  ```

<!-- TODO: move this tip to a better place -->

:::tip Technical tip
When the installation system boots, the agama-proxy-setup service will read the proxy URL to be used
from the kernel command line options or through the dracut ask prompt configuration file writing it
to the /etc/sysconfig/proxy. After that the microOS Tools setup-systemd-proxy-env systemd service
will make the proxy variables from that file available to all the systemd units writing a systemd
config file with all the variables as Environment ones.
:::
