[![Coverage Status](https://coveralls.io/repos/github/yast/d-installer/badge.svg?branch=master)](https://coveralls.io/github/yast/d-installer?branch=master)

# D-Installer: A Service-based Linux Installer

D-Installer is a new Linux installer born in the core of the YaST team. It is designed to offer re-usability, integration with third party tools and the possibility of building advanced user interfaces over it.

  |||||
  |-|-|-|-|
  |![Product selection](./doc/images/screenshots/product-selection.png) |![Installation overview](./doc/images/screenshots/overview.png) |![Installing](./doc/images/screenshots/installing.png) |![Installation finished](./doc/images/screenshots/finished.png) |

## Why a New Installer

This new project follows two main motivations: to overcome some of the limitations of YaST and to serve as installer for new projects like SUSE ALP (Adaptable Linux Platform).

YaST is a mature installer and control center for SUSE and openSUSE operating systems. With more than 20 years behind it, YaST is a competent and flexible installer able to cover uncountable use cases. But time goes by, and the good old YaST is starting to show its age in some aspects:

* The architecture of YaST is complex and its code-base has too much technical debt.
* Designing and building rich and modern user interfaces is a real challenge.
* Sharing logic with other tools like Salt or Ansible is very difficult.
* Some in-house solutions like libyui difficult external collaboration.

SUSE is strongly working on its next generation operating system called ALP (Adaptable Linux Platform). ALP is designed to be a lean core system, moving most of the software and workloads to containers and virtual machines. For some cases, for example cloud and virtual machines, ALP based systems will be deployed with auto-installable images. But still there are quite some situations in which ALP must be installed in a more traditional way. A clear example consists on installing over bare metal where some system analysis is required beforehand. D-Installer is also intended to cover such use cases for ALP, offering a minimal but powerful installer able to support a wide range of scenarios (e.g., RAID, encryption, LVM, network storage, etc).

## Architecture

This project is designed as a service-client system, using D-Bus for process communication.

![Architecture](./doc/images/architecture.png)

D-Installer consists on a set of D-Bus services and a web client (an experimental CLI is also available). The services use YaST-based libraries under the hood, reusing a lot logic already provided by YaST. Currently D-Installer comes with six separate services, although the list can increase in the future:

* D-Installer service: it is the main service which manages and controls the installation process.
* Software service: configures the product and software to install.
* Users service: manages first user creation and configuration for root.
* Language service: allows to configure the language and keyboard settings.
* Storage service: analyzes and prepares the storage devices in order to perform the installation.
* Questions service: helper service used for requesting information from clients.

D-Installer offers a web interface and its UI process uses the [Cockpit's infrastructure](https://cockpit-project.org/) to communicate with the D-Bus services.

## How to run

There are two ways of running the project: a) by using a D-Installer live ISO image or b) by cloning and configuring the project.

### D-Installer Live ISO Image

The easiest way to give D-Installer a try is to grab a [live ISO image](https://build.opensuse.org/package/binaries/YaST:Head:D-Installer/d-installer-live/images) and boot it in a virtual machine. This is also the recommended way if you only want to play and see it in action. If you want to have a closer look, then clone and configure the project as explained in the next section.

### Manual Configuration

You can run D-Installer from its sources by cloning and configuring the project:

~~~
$ git clone https://github.com/yast/d-installer
$ cd d-installer
$ ./setup.h
~~~

Then point your browser to http://localhost:9090/cockpit/@localhost/d-installer/index.html and that's all.

Note that the [setup.sh](./setup.sh) script installs the required dependencies to build and run the project and it also configures the D-Installer services and cockpit. Alternatively, just go through the following instructions if you want to do it manually:

* Install dependencies:

~~~
$ sudo zypper in gcc gcc-c++ make openssl-devel ruby-devel augeas-devel npm cockpit
~~~

* Setup the D-Installer services:

~~~
$ sudo cp service/share/dbus.conf /usr/share/dbus-1/system.d/org.opensuse.DInstaller.conf
$ cd service;
$ bundle config set --local path 'vendor/bundle';
$ bundle install
$ cd -
~~~

* Set up the web UI:

~~~
$ sudo ln -s `pwd`/web/dist /usr/share/cockpit/d-installer
$ sudo systemctl start cockpit
$ cd web
$ make devel-install
$ cd -
~~~

* Start the services: beware that D-Installer must run as root (like YaST does) to do hardware probing, partition the disks, install the software and so on.

~~~
$ cd service
$ sudo bundle exec bin/d-installer
~~~

* Check that D-Installer services are working with a tool like
[busctl](https://www.freedesktop.org/wiki/Software/dbus/) (or
[D-Feet](https://wiki.gnome.org/Apps/DFeet)) if you prefer a graphical one:

~~~
$ busctl call org.opensuse.DInstaller /org/opensuse/DInstaller/Language1 \
    org.opensuse.DInstaller.Language1 AvailableLanguages

$ busctl call org.opensuse.DInstaller /org/opensuse/DInstaller/Language1 \
    org.freedesktop.DBus.Properties GetAll s org.opensuse.DInstaller.Language1
~~~

## How to Contribute

If you want to contribute to this project, then please open a pull request or report an issue. You can also have a look to our [road-map](https://github.com/orgs/yast/projects/1/views/1).

## Development Notes

* [Working with the web UI](./web/README.md).