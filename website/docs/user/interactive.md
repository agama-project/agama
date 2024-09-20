---
sidebar_position: 1
---

# Interactive installation

Agama features a web-based user interface that you can use to install the system either locally or
from a remote device. For local installations, once you boot [the Live image](../download), you
should get to the product selection screen. If you want to connect from a remote device, please
check the [connecting remotely] section.

Assuming that you are already connected to the system you want to install, let's go briefly through
the installation workflow.

## Installation process

### Product selection

Agama allows installing several SUSE and openSUSE-based distributions. The [openSUSE-based
image](../download) image includes [openSUSE Tumbleweed](https://www.opensuse.org/#Tumbleweed),
[openSUSE Leap 16.0 Alpha](https://www.opensuse.org/#Leap) and [openSUSE Micro
OS](https://get.opensuse.org/microos/).

It is noteworthy to mention that the product selection does not only determine which software we
will install, but it may affect other aspects like the system's partitioning.

![Product selection screen offering openSUSE Leap, MicroOS and
Tumbleweed](/img/user/product-selection.png)

You can change the product later if you change your mind, but you should carefully check the
configuration as some values can be reset.

### The overview page

Once you select a product, Agama takes you to the _overview page_. In the main area, you can find a
summary of the installation settings (localization, storage and software) and a list of things you
need to fix before starting the installation. In the image below, Agama is asking to define a user
or set an authentication method for the `root` user.

If there are no issues to solve, Agama will display the `Install` button which, unsurprisingly,
starts the installation. Check the [Starting the installation](#installing) section for further
information.

![Overview of the installation settings](/img/user/overview.png)

However, it is worth to pay attention to the rest of the page. The **sidebar** at the left contains a
set of links to navigate to different installer areas (e.g., **Localization**, **Network**,
**Storage**, etc.). You can follow those links to revisit and/or change the installation settings
for those areas.

This **sidebar** can be shown/hidden by clicking in the icon at the top (the one with the three
bars). It is important to know that, depending on the form factor of your device, this _sidebar_
could be automatically hidden.

Below those links, you can find a **Change product** link that allows you to select a different
product, as discussed above.

Finally, at the top right corner, there is an icon that displays the localization settings for the
installer itself. It is important to know that changing them would not have effect on the installed
system (use the **Localization** section instead).

### Localization

This section allows to select the language, keyboard layout and timezone that the system you are
installing will use. Just click on the corresponding **Change** button to change any of them.

![Language, keyboard layout and timezone options](/img/user/localization.png)

As there are dozens of possible values, Agama features an small search box to make it easier to find
the value you want to select.

![Filtering the list of languages by country](/img/user/select-language.png)

### Network

Agama makes it easy to adjust your network configuration. It allows setting up wired and wireless
devices, specifying the mode (DHCP/manual), IP addresses, name servers, etc. Advanced
connections types, like bridges or bonds, does not have support in the user interface yet. However,
it is a matter of time that they get added, given that Agama supports many of them during an
[unattended installation](./unattended.md) or using the [command-line interface](./cli.md).

:::warning Changes are applied instantly
Beware that network configuration changes are applied instantly. So you must be careful when
adjusting the network configuration on a remote installation.
:::

![Network settings including wired and wireless devices](/img/user/network.png)

### Storage

Without a doubt, storage configuration is one of the strongest areas of YaST. And, although it is
still a work in progress, Agama aims to play in the same league. Advanced features are landing into
Agama at good pace, especially because it shares most of the storage-related codebase with YaST.

However, when it comes to the user interface, Agama approach is rather different.

<!-- TODO: explain why and how they are so different -->

![Storage configuration, including devices selection, encryption, partitions and file systems, etc.](/img/storage.png)

### Software

Agama software selection is rather simple. Depending on the product, it offers a reduced set of
software pattern. The image below partially shows how the software selector looks like. As in other
places of the interfaces, Agama offers a search box. If you need any advanced package selection, we
suggest to do it once the system is installed.

![Software selection including a short list of software patterns](/img/user/software.png)

### Users

Most likely you need a mechanism to access the system once it is installed. Agama offers you to set
up a `root` authentication method (a password or a public key) and/or to create a dedicated user. It
is mandatory to do any before starting the installation.

![Users section including the root authentication and the dedicated user](/img/user/users.png)

### Starting the installation {#installing}

The overview page displays an `Install` button if all the issues are solved. After clicking the
button, Agama ask for confirmation. Once you accept, the installation starts.

![Overview page containing the `Install` button](/img/user/install-button.png)

## Remote access

The Live ISO automatically starts a graphical interface (using the local browser). However, you
might want to access remotely to the installer. If you know the IP address of the system, you just
need to point your browser to `https://$IP`.

For the case you do not know the address, or just for convenience, the Live ISO is configured to use
mDNS (sometimes called Avahi, Zeroconf, Bonjour) for hostname resolution. Therefore, connecting to
`https://agama.local` should do the trick.

:::warning Beware of the `.local` hostname
Do not use the `.local` hostnames in untrusted networks (like public WiFi networks, shared
networks), it is a security risk. An attacker can easily send malicious responses for the `.local`
hostname resolutions and point you to a wrong Agama instance which could for example steal your root
password!
:::
