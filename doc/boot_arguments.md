# Reading arguments from kernel command line

Agama configuration can be altered through the kernel command line. It is possible to load a
full configuration file or to change some specific values.

## Loading a new configuration file

It is possible to load a new configuration file specifying a URL through the `agama.config_url`
option. Here are some examples:

* `agama.config_url=http://192.168.122.1/my-agama.yaml`
* `agama.config_url=usb:///agama.yaml`

See [URL handling in the
installer](https://github.com/yast/yast-installation/blob/master/doc/url.md) to find more details
about the supported URLs.

## Changing configuration values

Instead of loading a full configuration file, you might be interested in adjusting just a few
configuration values. You must specify the option name in dotted notation. A typical use-case might
be to use your own SSL certificates:

```
agama.web.ssl=true agama.web.ssl_cert=http://192.168.122.1/mycert.pem agama.web.ssl_key=http://192.168.122.1/mycert.key
```

Changing complex options (e.g., collections) is not supported yet.

## Proxy Setup

Agama supports proxy setup using the `proxy=` kernel command line option like 
`proxy=http:192.168.122.1:3128`.

When the installation system boots, the agama-proxy-setup service will read the proxy url to be
used from the kernel command line options or through the dracut ask prompt configuration file 
writing it to the /etc/sysconfig/proxy. After that the microOS Tools setup-systemd-proxy-env 
systemd service will make the proxy variables from that file available to all the systemd units
writing a systemd config file with all the variables as Enviroment ones.
