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

The easiest way to give D-Installer a try is to install the
[rubygem-d-installer](https://build.opensuse.org/package/show/YaST:Head/rubygem-d-installer) and
[d-installer-web](https://build.opensuse.org/package/show/YaST:Head/d-installer-web) packages in an
[openSUSE Tumbleweed Live image](https://get.opensuse.org/tumbleweed).

You need to do some additional steps, like starting the Cockpit service or setting a password for
the "linux" user. To make things easier, the repository already contains [a script](./deploy.sh)
that takes care of everything. So after booting the image, just type:

    wget https://raw.githubusercontent.com/yast/the-installer/master/deploy.sh
    # inspect content to ensure that nothing malicious is done there
    sh deploy.sh

This process may take a while. Use `linux`/`linux` when the browser opens the log in form.

If you want to contribute to the project or just have a closer look, check the *Setup* section.

## Setup

If you want to contribute to the project, you can run D-Installer from sources. The first step
should be to install Git (if it is not already installed) and clone the repository:

    sudo zypper --non-interactive in git
    git clone https://github.com/yast/d-installer
    cd d-installer

If you want to save some time, run the [setup.sh script](./setup.sh) and follow the instructions at
the end. If you want to do it manually, just go through the following process.

### Dependencies

To build and run this software you need a few tools. To install them on openSUSE Tumbleweed just
type:

    sudo zypper in gcc gcc-c++ make openssl-devel ruby-devel augeas-devel npm cockpit

The user interface uses Cockpit infrastructure to interact with the D-Bus interface, so you
need to make sure that `cockpit` is running:

    sudo systemctl start cockpit

### The `d-installer` Service

`d-installer` is a YaST-based service that is able to install a system. You can interact with that
service using the D-Bus interface it provides.

Beware that `d-installer` must run as root (like YaST does) to do hardware probing, partition the
disks, install the software and so on. So you need to tell dbus about the service by copying
`yastd/share/dbus.conf` to `/etc/dbus-1/system.d/d-installer.conf`.

To run the service, type:

    cd yastd
    bundle install
    sudo bundle exec bin/d-installer

To check that `d-installer` is working, you can use a tool like
[busctl](https://www.freedesktop.org/wiki/Software/dbus/) (or
[D-Feet](https://wiki.gnome.org/Apps/DFeet)) if you prefer a graphical one:

    busctl call org.opensuse.YaST /org/opensuse/YaST/Installer \
      org.opensuse.YaST.Installer GetDisks

If you want to get the properties, just type:

    busctl call org.opensuse.YaST /org/opensuse/YaST/Installer \
      org.freedesktop.DBus.Properties GetAll s org.opensuse.YaST.Installer

### Web-Based User Interface

The current UI is a small web application built with [React](https://reactjs.org/). On production it
is meant to be served by `cockpit-ws` from a directory in `XDG_DATA_DIRS` (e.g.,
`/usr/share/cockpit/static/installer`). Building the code might time some time, so there is a
*development mode* available that reloads the code everytime it changes.

### Development Mode

It allows to set a few installation parameters and start the installation (not implemented yet).

    cd web
    npm install
    npm start

Point your browser to http://localhost:3000 and happy hacking!

### Production-like Mode

    cd web
    npm run build
    sudo mkdir /usr/share/cockpit/static/installer
    sudo mount -o bind build /usr/share/cockpit/static/installer

Point your browser to http://localhost:9090/cockpit/static/installer/index.html and enjoy!

## References

* [Development Notes](./DEVELOPMENT.md)
