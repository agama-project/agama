# What is Agama?

Agama is a new Linux installer born in the core of the [YaST](https://yast.opensuse.org/) team. It
is designed to offer re-usability, integration with third party tools and the possibility to
build advanced user interfaces over it.

It offers an HTTP API to control and monitor the whole installation process and comes with two user
interfaces: a modern web front-end and a powerful command-line tool.

Agama can perform interactive and unattended installations, making it possible even to mix both
approaches with any combination of manual work and automation.

Agama reuses many of the principles and internal components of (Auto)YaST, ensuring it can handle
a similar number of architectures and technologies. It also offers a high level of backwards
compatibility with AutoYaST for unattended installations, being often able to act as a drop-in
replacement.

## A Linux Installer...

From a very simplistic and high level view, there are basically two methods to deploy a
Linux operating system - using a pre-built image and performing an installation.

The first method is direct and simple, but it cannot address all scenarios. On the other hand,
an installer can always be used to deploy a new Linux system through some general steps.

  - Configure the network and the storage setup, potentially including remote storage, partitioning,
    LVM, encryption, etc.
  - Deploy the target system over that storage setup, eg. installing the appropriate set of RPM
    packages.
  - Customize the aspects of the system needed for the first boot, like boot loader, kdump,
    authentication, etc.
  - Give control to the new system, via kexec or hardware reboot.

Agama turns that process into a seamless experience.

## ... and Just an Installer

Unlike its predecessor YaST, known for been both a Linux installer and a general configuration
tool, Agama focuses on system installation.

As a pure deployment tool, Agama takes care of those aspects that:
  - can only be handled during installation itself or
  - are needed to get a minimal functional system that can be booted and configured in a secure way.

As such, Agama is not present at the final installed system and minimizes overlapping with more
general configuration tools.

![Deploy and configuration tools](/img/deploy-configure.png)

## More Details

If you need more information about what Agama can do, the plans for the future, how it compares to
YaST or the level of compatibity with AutoYaST, check the [Frequenly Asked Questions](/faq).
