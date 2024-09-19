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

- `live.password` and `live.password_hash` Set the `root` password of the live system.
  `live.password` accepts a plain text password, while `live.password_hash` is expected to receive a
  hashed password, which is more secure. The disadvantage of a hashed password is that it is quite
  long and is not easy to type it into the boot prompt manually. It makes sense in environments where
  you can prepare the boot parameters in advance like in PXE boot or some virtual machines.

  ```text
  live.password=nots3cr3t
  ```

  :::warning Setting a password enables SSH
  The SSH service is not started unless a password is provided using any of the available options
  (`live.password`, `live.password_hash`, `live.password_dialog`, or `live.password_systemd`). This
  avoids accidentally using the default password from the medium.
  :::

- `live.password_dialog` Start an interactive dialog during the boot process. This uses a nice
  dialog for entering and confirming the password. However, in some situations the full screen dialog
  might not be displayed correctly or some messages might be displayed over it. In that case you might
  use the `Ctrl+L` key shortcut to refresh the screen. If it still does not work then try using the
  other option below.

  ```text
  live.password_dialog
  live.password_dialog=1
  ```

- `live.password_systemd` Ask for a password using a simple prompt. This is
  similar to the option above, but the advantage is that this solution does not use a full screen
  dialog but a single line prompt so it should work better in special environments like a serial
  console.

  ```text
  live.password_systemd
  live.password_systemd=1
  ```

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
