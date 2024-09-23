# What is Agama?

Agama is a new Linux installer born in the core of the [YaST](https://yast.opensuse.org/) team. It
is designed to offer re-usability, integration with third party tools and the possibility of
building advanced user interfaces over it.

It offers an HTTP API to control and monitor the whole installation process and comes with two user
interfaces: a modern web front-end and a powerful command-line tool.

Agama is capable of performing both interactive and unattended installations. Moreover, both
approaches can be combined in a single installation process driven by any combination of manual work
and automation, integrated or not into a bigger infrastructure.

Agama reuses many of the principles and internal components of (Auto)YaST, making sure it can handle
a similar number of architectures and technologies.

## A Linux installer?

From a very simplistic and high level view, there are basically two methods to deploy a
Linux operating system:

- using a pre-built image,
- performing an installation.

The first method is direct and simple, but there are scenarios that cannot be addressed just by
deploying an image. For those cases, you can use an installer to deploy the new system through some
general steps.

- Perform some basic network configuration.
- Configure the storage setup for the target system (partitioning, LVM, encryption, etc.)
- Deploy the target system over that storage setup (eg. installing the appropriate set of RPM
  packages).
- Customize the aspects of the system needed for the first boot (bootloader, kdump, authentication,
  etc.).
- Give control to the new system (via kexec or hardware reboot).

Agama turns that process into a seamless experience.

## Just an installer

Unlike its predecessor YaST, Agama...

Focused on installation. Not present on the system after installation.

Agama is a deployment tool, taking care of those aspects that:

- can only be handled during installation itself or
- are needed to get a minimal functional system that can be booted and configured in a secure way.

![Deploy and configuration tools](/img/deploy-configure.png)
