---
sidebar_position: 4
---

# Startup process

As described in the [architecture section](./architecture), Agama is composed of a web server, a
set of D-Bus services, a web client and a command-line interface. The startup process aims to get
those D-Bus services up and running and make the web server available. Additionally, the
auto-installation procedure could be started if required by the user.

The startup process is handled by systemd and D-Bus. The only exception is starting the local
browser in the Agama Live image.

## Starting the D-Bus Services

[agama.service](https://github.com/openSUSE/agama/blob/master/service/share/agama.service) is
responsible for starting up Agama's D-Bus daemon process using the `agamactl --daemon` command. This
process uses a dedicated bus with a [specific
configuration](https://github.com/openSUSE/agama/blob/master/service/share/dbus.conf).

Once the daemon process is running, each D-Bus service will be automatically activated when
required. The definitions of those services are located in `/usr/share/dbus-1/agama-services`,
although you can find the sources in the
[repository](https://github.com/openSUSE/agama/tree/master/service/share)
(`org.opensuse.Agama*.service` files).

## Starting the web server

[agama-web-server](https://github.com/openSUSE/agama/blob/master/rust/share/agama-web-server.service)
is responsible for starting up Agama's web server using the `agama-web-server` command.

## Auto-installation

If the `agama.auto` option is specified in the kernel command-line, the
[agama-auto.service](https://github.com/openSUSE/agama/blob/master/autoinstallation/systemd/agama-auto.service)
comes into play. It runs after the `agama-web-server.service` so the web server and the D-Bus daemon
are ready.

## Web user interface

When discussing the web user interface, we can distinguish two sides: the server process and the web
browser. Regarding the server, Agama's web UI is implemented as a React application which is served
by the web server. You can connect to the UI using the `http://$SERVER_IP` address.

When using Agama Live, a local web browser is automatically started. In the default image, it is
launched using an [IceWM startup
script](https://github.com/openSUSE/agama/blob/master/live/root/root/.icewm/startup).
