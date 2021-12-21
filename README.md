# Service-based Experimental Installer

The idea of this repository is to build a proof-of-concept of a Linux installer that runs as a
service. At first sight, we have identified these components:

* A YaST-based library that performs the system installation. It represents the installer itself
  and, additionally, it features an API to query and set installation options (product to install,
  disk, etc.).
* A [D-Bus](https://www.freedesktop.org/wiki/Software/dbus/) service which exposes the installer's
  API.
* A user interface. For this experiment, we have decided to use a
  [Cockpit](https://cockpit-project.org/) module.

## yastd

`yastd` is a YaST-based service that is able to install a system. You can interact with such a
service using the D-Bus interface it provides.

Beware that `yastd` must run as root (like YaST does) to do hardware probing, partition the disks,
installs the software and so on. So you need to tell dbus about the service by copying
`yastd/share/dbus-yastd.conf` to `/etc/dbus-1/system.d/yastd.conf`.

To run the service, type:

    $ cd yastd
    $ sudo ruby bin/yastd

You can use a tool like [busctl](https://www.freedesktop.org/wiki/Software/dbus/) (or
[D-Feet](https://wiki.gnome.org/Apps/DFeet) if you prefer a graphical one:

    $ busctl call org.opensuse.YaST /org/opensuse/YaST/Installer \
      org.opensuse.YaST.Installer GetDisks

If you want to get the properties, just type:

    $ busctl call org.opensuse.YaST /org/opensuse/YaST/Installer \
      org.freedesktop.DBus.Properties GetAll s org.opensuse.YaST.Installer

# References

* https://etherpad.opensuse.org/p/H_bqkqApbfKB5RwNIYSm
