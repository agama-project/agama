# Service-Based Experimental Installer

The idea of this repository is to build a proof-of-concept of a Linux installer that runs as a
service. At first sight, we have identified these components:

* A YaST-based library that performs the system installation. It represents the installer itself
  and, additionally, it features an API to query and set installation options (product to install,
  disk, etc.).
* A [D-Bus](https://www.freedesktop.org/wiki/Software/dbus/) service which exposes the installer's
  API.
* A user interface. For this experiment, we have decided to base on
  [Cockpit](https://cockpit-project.org/), although it does not run as a
  regular mode (it only uses Cockpit's infrastructure).

## Quickstart

:warning: :warning: **This is a proof-of-concept so, PLEASE, use a virtual machine to give it a try.** :warning: :warning: 

Boot to any [openSUSE Tumbleweed Live
image](https://get.opensuse.org/tumbleweed) and, in the console, type:

    $ wget https://raw.githubusercontent.com/yast/the-installer/master/deploy.sh
    $ # inspect content to ensure that nothing malicious is done there
    $ sh deploy.sh

This process may take a while. Use `linux`/`linux` when the browser opens the log in form.

The *Setup* section explains how to set-up the installer manually.

TODO: use a url shortener

## Setup

To build and run this software you need a few tools. To install them on openSUSE
Tumbleweed just type:

    $ sudo zypper in gcc gcc-c++ make openssl-devel ruby-devel augeas-devel npm cockpit

## yastd

`yastd` is a YaST-based service that is able to install a system. You can interact with such a
service using the D-Bus interface it provides.

Beware that `yastd` must run as root (like YaST does) to do hardware probing, partition the disks,
installs the software and so on. So you need to tell dbus about the service by copying
`yastd/share/dbus-yastd.conf` to `/etc/dbus-1/system.d/yastd.conf`.

To run the service, type:

    $ cd yastd
    $ bundle install
    $ sudo bunle exec bin/yastd

To check that everything `yastd` is working, you can use a tool like
[busctl](https://www.freedesktop.org/wiki/Software/dbus/) (or
[D-Feet](https://wiki.gnome.org/Apps/DFeet) if you prefer a graphical one:

    $ busctl call org.opensuse.YaST /org/opensuse/YaST/Installer \
      org.opensuse.YaST.Installer GetDisks

If you want to get the properties, just type:

    $ busctl call org.opensuse.YaST /org/opensuse/YaST/Installer \
      org.freedesktop.DBus.Properties GetAll s org.opensuse.YaST.Installer

## Cockpit

The user interface uses Cockpit infrastructure to interact with the D-Bus interface, so you
need to make sure that `cockpit` is running:

    $ sudo systemctl start cockpit

## Web-Based User Interface

The current UI is a small web application built with [React](https://reactjs.org/). On production it
is meant to be served by `cockpit-ws` from an directory in `XDG_DATA_DIRS` (e.g.,
`/usr/share/cockpit/static/installer`). Building the code might time some time, so there is a
*development mode* available that reloads the code everytime it changes.

### Development Mode

It allows to set a few installation parameters and start the installation (not implemented yet).

    $ cd web
    $ npm install
    $ npm start

Point your browser to http://localhost:3000 and happy hacking!

### Production-like Mode

    $ cd web
    $ npm run build
    $ sudo mkdir /usr/share/cockpit/static/installer
    $ sudo mount -o bind build /usr/share/cockpit/static/installer

Point your browser to http://localhost:9090/cockpit/static/installer/index.html and enjoy!

## References

* [Development Notes](./DEVELOPMENT.md)
