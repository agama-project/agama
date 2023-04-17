# Network Support Planning

This document summarizes the plan to add proper networking support to Agama. It is still under
discussion, so expect some things to change.

## What scenarios/features do we want to support?

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

## Current situation

Networking support in Agama is far from being finished. At this point, only the web UI allows
setting up simple scenarios:

* DHCP and static configuration of Ethernet devices.
* Connection to wireless devices with limited authentication settings.

Moreover, it connects directly to the NetworkManager D-Bus interface, so the Agama service is not
really involved. So if you want to set up the network using the CLI, you need to use `nmcli` and
rely on Agama to copy the configuration files at the end of the installation.

## Considered options

Based on the situation described above, we considered these approaches:

1. Implement support to set up the network through Agama D-Bus service.
2. Keep the status quo, extend the web UI and rely on `nmcli` for the CLI-based installation. For
   automation, we could rely on third-party tool.

Although it might be harder, option 1 looks more consistent: you just need Agama D-Bus interface to
perform an installation.

## Adding our own D-Bus interface

Adding a D-Bus interface does not mean that we need to implement a full solution to set up the
network. Actually, we can leverage some third-party tool to do the hard work. The idea is to build a
good enough interface to support our use cases.

### Why not YaST2?

You might be wondering, why not use YaST2 itself? Let's see some reasons:

* It does not implement support for reading the NetworkManager configuration.
* It is not able to talk to NetworkManager D-Bus interface. It configures NetworkManager by writing
  the connection files.
* It is Ruby-based, so we might consider a Rust-based solution.

### The proposal

Our proposal is to build a D-Bus service that wraps around a third-party tool that takes care of the
hard part. We considered [Netplan](https://netplan.io/) and [nmstate](https://nmstate.io/), although
we decided to use the latter (see [Third-party tools](#third-party-tools)).

Unfortunately, those tools are missing support for some cases (e.g., wireless configuration or udev
handling), but we can add such a support in our wrapper.

## Third-party tools

Both [Netplan](https://netplan.io/) and [nmstate](https://nmstate.io/) are tools that allow 

### nmstate

- Based on devices/interfaces (the concept of connection does not exist).
- Designed to support multiple network providers, but at this point only NetworkManager is
  supported.
- Offered as a Rust library.
- Bindings for several languages and a CLI.
- Support for WiFi and VPNs is missing.

### Netplan

- Written in Python.
- Designed to support multiple network providers, nowadays it supports NetworkManager and networkd.
- It offers a rather limited D-Bus API.
