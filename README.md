# Service-based Experimental Installer

The idea of this repository is to build a proof-of-concept of a Linux installer
that runs as a service. At first sight, we have identified these components:

* A YaST-based library that performs the system installation. It represents the
  installer itself and, additionally, it features an API to query and set
  installation options (product to install, disk, etc.).
* A [D-Bus](https://www.freedesktop.org/wiki/Software/dbus/) service which
  exposes the installer's API.
* A user interface. For this experiment, we have decided to use a
  [Cockpit](https://cockpit-project.org/) module.

# References

* https://etherpad.opensuse.org/p/H_bqkqApbfKB5RwNIYSm
