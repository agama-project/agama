#### Avahi/mDNS

Agama's Live ISO is configured to use mDNS (sometimes called Avahi, Zeroconf, Bonjour) for hostname
resolution. The reason is that it might be quite difficult to find out which URL should be used for
connecting to a running Agama installer.

This document explains how this feature works and offers a few hints for fix potential problems.

>[!WARNING]
> Do not use the `.local` hostnames in untrusted networks (like public WiFi networks, shared
> networks), it is a security risk. An attacker can easily send malicious responses for the `.local`
> hostname resolutions and point you to a wrong Agama instance which could for example steal your
> root password!

##### Firewall Configuration

If you cannot connect to a server using the `.local` domain then maybe the
firewall is blocking the traffic. Then you need to enable the mDNS traffic using
these commands:

```shell
# enable the mDNS traffic in the current run
firewall-cmd --zone=public --add-service=mdns
# make the change permanent
firewall-cmd --permanent --zone=public --add-service=mdns
```

##### Using mDNS

The Live ISO by default uses the `agama.local` hostname. To connect to the
running instance simply type `https://agama.local` in your browser. In most
browsers the HTTPS is the default protocol so usually it is enough to just type
`agama.local`.

If you run multiple Agama instances, each one will have a different name. The server
appends a number to make it unique. So the second Agama instance gets the
`agama-2.local` hostname.

If you are not sure whether there are multiple Agama instances running you scan
the network, see the [service advertising](#service-advertising) below.

Alternatively you can set a different hostname for each instance manually. Use
the `hostname=` boot option to set a different hostname. For example set
`hostname=foo`, `hostname=bar` and then use `https://foo.local`,
`https://bar.local` URLs in the web browser to connect to the respective
instance.

It is possible to change the hostname later if needed:

```shell
# set the new hostname
hostnamectl hostname <hostname>
# restart the avahi daemon server
systemctl restart avahi-daemon
```

The mDNS resolution also works for other services like ping or SSH. So you can
use commands like:

```shell
ping agama.local
ssh root@agama.local
```

##### Fallback

The mDNS approach is just an addition, one more possibility how to connect to
the machine. If it does not work for you then you can always use the old good
classic IP address approach.

##### Service Advertising

The Agama Live ISO also uses Avahi service advertising. With this you can easily
search for all running Agama instances in the local network:

```shell
avahi-browse -t -r _agama._sub._https._tcp
```

The command will print the found servers and their hostnames and IP addresses.

##### Notes

- mDNS works only in the same local network, it does not work over internet
  or separate network segments.
- mDNS might not be supported in all systems or it might be blocked by firewall.
- On mobile phones with Android OS mDNS is supported since Android version 12.
  (but this might be vendor dependent...).


