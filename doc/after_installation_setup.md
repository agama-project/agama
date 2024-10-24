# Further configuration

TL;DR Agama will support running post-installation scripts after the first boot. No specific support
for a CMS[^cms], Combustion/Ignition, etc.

It is rather typical that users want to perform some additional configuration steps once the
installation is finished. To cover those use cases, AutoYaST offers support for running
[user-defined
scripts](https://documentation.suse.com/sles/15-SP5/html/SLES-all/cha-configuration-installation-options.html#createprofile-scripts)
and the [YaST2 Configuration Management
module](https://github.com/yast/yast-configuration-management/).

But what are the plans for Agama? This document describes Agama's take on this topic, including the
rationale behind the decision.

[^cms]: Configuration Management System

## Using user-defined scripts

Enabling users to run their own scripts is the minimal Agama could do. With that support, a user can
decide what to do with them. Actually, SUMA and many customers already follow this approach with
AutoYaST.

Furthermore, it looks like a must if we want to offer a good level of backward compatibility with
AutoYaST. However, whether we should unify the `post-installation` and `init-scripts` into a single
type of scripts is debatable.

## Setting up a CMS

The [YaST2 Configuration Management module](https://github.com/yast/yast-configuration-management/)
can set up the system to connect to a CMS. It even supports [Salt parametrizable
formulas](https://imobachgs.github.io/yast/2017/03/01/yast2-cm-gets-support-for-salt-parametrizable-formulas.html)
since 2017. However, we have the impression that no one uses them in the context of AutoYaST.

As this set up can be achieved by using a user-defined script, we will not implement specific
support for any CMS (at least by now).

## Using Combustion/Ignition

[openSUSE MicroOS](https://microos.opensuse.org/) images rely on Combustion (or Ignition) to perform
additional configuration steps, so we considered to use it in Agama too. However, you cannot use the
root file system to provide the Combustion scripts (and additional assets). You need to provide an
additional source (a URL, a USB stick, or specific
[QEMU](https://www.qemu.org/docs/master/specs/fw_cfg.html) and
[VirtualBox](https://docs.vmware.com/en/VMware-Tools/12.4.0/com.vmware.vsphere.vmwaretools.doc/GUID-D026777B-606D-4442-957A-B953C2049659.html)
mechanisms).

For that reason, Agama will not rely on Combustion by now.

## References

- [PED-10827](https://jira.suse.com/browse/PED-10827)
