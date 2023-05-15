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

Although it might be harder, option 1 looks more consistent: you can install your system just using
Agama D-Bus interface.

## Adding our own D-Bus interface

Adding a D-Bus interface does not mean that we need to implement a full solution to set up the
network. The idea is to build a good enough API to support our use cases.

Initially, we though about adding the D-Bus API on top of [nmstate](https://nmstate.io/), although
it covers a different use-case. After playing a bit with this idea, we decided to come up with a
solution more aligned with our needs.

As an alternative, you might be wondering why not use YaST2 itself? Let's see some reasons:

* It does not implement support for reading the NetworkManager configuration.
* It is not able to talk to NetworkManager D-Bus interface. It configures NetworkManager by writing
  the connection files.
* It is Ruby-based, so we might consider a Rust-based solution. It is not a language problem, but we
  would like to reduce the memory consumption.

## The proposal

Agama's network service is responsible for holding the network configuration for the installer. It
should be agnostic from the used network service, although in the short-term it will support
NetworkManager only. Therefore, the current solution is influenced by NetworkManager itself.

In a first version, the API is composed of the following objects:

* Network devices. Each one is available as an object under `/org/opensuse/Agama/Network1/Device/*`
  exposing the current status[^1].
* Connections (or configurations). They are exposed as `/org/opensuse/Agama/Network1/Connection/*`.
  Depending on the type of connection, those objects implements different interfaces like
  `org.opensuse.Agama.Network1.IPv4`, `org.opensuse.Agama.Network1.Wireless`, etc.

This API could be expanded in the future to provide a list of access points, emit signals when the
configuration changes, provide more information about the network devices, etc.

[^1]: By now it only exposes some basic data, as the current status is only needed by the web UI.
