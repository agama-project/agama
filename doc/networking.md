# Networking Support

In general, we are focused on scenarios that are important for the installation process. Defining
a set up to be used *after the installation* is out of scope.

Here is a preliminary list of the scenarios/features we would like to support. In general, we should
focus on scenarios that are important for the installation.

* Specify a static configuration, useful where no DHCP is available or the configuration needs some
  extra change:
  - IPv4 / IPv6 (optionally in addition to the DHCP settings)
  - DNS configuration (needed to reach the repositories)
  - Routing configuration (needed to work on some specific networks)
* Use the DHCP provided configuration, allowing the user to adapt it if needed.
* Connect to a wireless network, adding support for the most common authentication mechanisms.
* Define a proxy to access the network.
* High availability scenarios. This features are critical when working with remote storage, network
  redundancy and so on. NTP configuration very important here. We should support:
  - Bonding
  - Bridge
  - VLAN
* s390 deployment: devices activation (port number and layer 2/3 configuration).
* VPN (?). If needed, which one?

Other interesting use cases:

* Provide multiple WiFi networks (in the unattended installation) and select one available during
  installation. You could reuse the same profile and deploy on different places.
