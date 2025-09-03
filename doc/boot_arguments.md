# Reading arguments from kernel command line

Agama configuration can be altered through the kernel command line. It is possible to load a
full configuration file or to change some specific values.

## Loading a new configuration file

It is possible to load a new configuration file specifying a URL through the `inst.config_url`
option. Here are some examples:

* `inst.config_url=http://192.168.122.1/my-agama.yaml`
* `inst.config_url=usb:///agama.yaml`

See [URL handling in the
installer](https://github.com/yast/yast-installation/blob/master/doc/url.md) to find more details
about the supported URLs.

## Custom Installation URL Configuration

You can override the default `installation_url` set in the product files [here](https://github.com/openSUSE/agama/tree/master/products.d) by passing the `inst.install_url` parameter as a boot option in the bootloader.
This is particularly useful for any pre-production testing in openQA.

**Note:** Setting this variable will impact all products.

### Example Usage

To specify a custom installation URLs, pass following as a parameter to kernel in the bootloader.
You can specify multiple URLs by separating them with commas.

```
inst.install_url=https://myrepo,https://myrepo2
```

## Changing configuration values

Instead of loading a full configuration file, you might be interested in adjusting just a few
configuration values. You must specify the option name in dotted notation. A typical use-case might
be to use your own SSL certificates:

```
inst.web.ssl=true inst.web.ssl_cert=http://192.168.122.1/mycert.pem inst.web.ssl_key=http://192.168.122.1/mycert.key
```

Changing complex options (e.g., collections) is not supported yet.

## Proxy Setup

Agama supports proxy setup using the `proxy=` kernel command line option like 
`proxy=http://192.168.122.1:3128` when the installation requires to use an HTTP, HTTPS or FTP
source. The supported proxy URL format is: protocol://[user[:password]@]host[:port]

When the installation system boots, the agama-proxy-setup service will read the proxy URL to be
used from the kernel command line options or through the dracut ask prompt configuration file 
writing it to the /etc/sysconfig/proxy. After that the microOS Tools setup-systemd-proxy-env 
systemd service will make the proxy variables from that file available to all the systemd units
writing a systemd config file with all the variables as Enviroment ones.
