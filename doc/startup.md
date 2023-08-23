# Agama Startup Process

This document summarizes how Agama's startup process.

## Overview

As described in the [README](../README.md#architecture), Agama is composed by a set of D-Bus
services, a web client and a command-line interface. The startup process aims to get those D-Bus
services up and running and make the web UI available. Additionally, the auto-installation procedure
could be started if required by the user.

The startup process is handled by systemd and D-Bus. The only exception is starting the local
browser in the Agama Live image.

## Starting the D-Bus Services

[agama.service](../service/share/agama.service) is responsible for starting up Agama's D-Bus daemon
process using the `agamactl --daemon` command. This process uses a [specific
configuration](../service/share/dbus.conf).

Once the daemon process is running, each D-Bus service will be automatically activated when
required. The definitions of those services are located in `/usr/share/dbus-1/agama-services`,
although you can find the sources in the [repository](../service/share)
(`org.opensuse.Agama*.service` files).

## Auto-installation

If the `agama.auto` option is specified in the kernel command-line, the
[agama-auto.service](../service/share/systemd/agama-auto.service) comes into play. It runs after the
`agama.service` so the D-Bus daemon is ready and the services can be activated as needed.

## Web UI

When discussing the web UI, we can distinguish two sides: the server process and the web browser.
Regarding the server, Agama's web UI is implemented as a Cockpit module, so the only requirement is
that the `cockpit.socket` is enabled. Then, you can connect to the UI using the
`https://$SERVER_IP:9090/cockpit/@localhost/agama/index.html`.

When using Agama Live, a local web browser is automatically started. In the default image, it is
launched using an Icewm startup script[^1].

[^1]: Check the `root.tar` file from the [agama-live](https://build.opensuse.org/package/show/systemsmanagement:Agama:Devel/agama-live) sources.
