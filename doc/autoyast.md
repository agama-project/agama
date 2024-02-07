# AutoYaST Support

Agama offers a mechanism to perform [unattended installations](../autoinstallation/). However, we
would like AutoYaST users to be able to use their AutoYaST profiles in Agama. This document
describes how Agama could support, to some extent, such profiles.

Bear in mind that this document is just a draft and our plans could change once we start working
on the implementation.

## What to support

We want to point out that Agama and AutoYaST have different features. Agama is focused on the
installation and delegates further configuration to other tools. From this point of view, it is
clear that many of the sections you can find in an AutoYaST profile will not have an Agama
counterpart.

Nevertheless, we want to cover:

* Dynamic profiles, including rules/classes, ERB templates, pre-installation scripts and even "ask
lists". See [Dynamic profiles](#dynamic-profiles).
* Compatibility (partial or full) for the following sections: `networking`, `partitioning`,
`language`, `timezone`, `keyboard`, `software`, `scripts`, `users`, `iscsi-client`, `proxy` and
`suse_register`. See [Supported sections](#supported-sections).

We still need to decide how to handle other sections like `firewall`, `bootloader`, `report`,
`general` or even some elements from `security` or `kdump`.

Finally, we plan to "ignore" many other sections (e.g., all *-server elements) and sysconfig-like
elements. See [Unsupported sections](#unsupported-sections).

## Dynamic profiles

Many AutoYaST users rely on its dynamic capabilities to build adaptable profiles that they can use
to install different systems. For that reason, we need Agama to support these features:

* [Rules and classes][rules-classes].
* [Embedded Ruby (ERB)][erb].
* [Pre-installation scripts][pre-scripts].
* [Ask lists]().

The most realistic way to support those features in the mid-term is to use the AutoYaST code with
some adaptations. The [import-autoyast-profiles branch][autoyast-branch] contains a proof-of-concept
that supports rules/classes, ERB and pre-installation scripts. If you are interested, you can give
it a try:

```
cd service
sudo bundle exec bin/agama-autoyast \
  file:///$PWD/test/fixtures/profiles/invalid.xml /tmp/output
cat /tmp/output/autoinst.json
```

You can even use the `agama-cli`:

```
cd rust
cargo build
sudo PATH=$PWD/../service/bin:$PATH ./target/debug/agama profile download \
  file:///$PWD/../service/test/fixtures/profiles/pre-scripts.xml 
```

About "ask lists", there might need more work. Fortunately, the code to [parse][ask-list-reader] and
[run][ask-list-runner] the process are there but we need to adapt the [user
interface][ask-list-dialog], which is not trivial.

[rules-classes]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/rulesandclass.html
[erb]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/erb-templates.html
[pre-scripts]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/cha-configuration-installation-options.html#pre-install-scripts
[ask-lists]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/cha-configuration-installation-options.html#CreateProfile-Ask
[autoyast-branch]: https://github.com/openSUSE/agama/tree/import-autoyast-profiles 
[ask-list-reader]: https://github.com/yast/yast-autoinstallation/blob/c2dc34560df4ba890688a0c84caec94cc2718f14/src/lib/autoinstall/ask/profile_reader.rb#L29
[ask-list-runner]: https://github.com/yast/yast-autoinstallation/blob/c2dc34560df4ba890688a0c84caec94cc2718f14/src/lib/autoinstall/ask/runner.rb#L50
[ask-list-dialog]: https://github.com/yast/yast-autoinstallation/blob/c2dc34560df4ba890688a0c84caec94cc2718f14/src/lib/autoinstall/ask/dialog.rb#L23

## Supported sections

### `dasd` and `iscsi-client`

Support for iSCSI and DASD devices is missing in Agama profiles. Let's work on that when adding the
`partitioning` section equivalent.

### `general`

AutoYaST `general` section contains a set of elements that, for some reason, did not find a better
place. Most of those options will be ignored by Agama (e.g., `cio_ignore`, `mode`, `proposals`,
etc.). However, we might need to add support for a handful of them.

Agama should process the `ask-list` section (see [Supported sections](#supported-sections)),
`signature-handling` (to deal with packages signatures) and, most probably, `storage` too (e.g.,
affects the proposal).

### `groups` and `users`

Regarding users, Agama only allows defining the first user and setting the root authentication
mechanism (password and/or SSH public key). However, AutoYaST allows to specify a list of users and
groups plus some authentication settings. We have at least two options here:

* Extract the root authentication data from the profile and try to infer which is the first user.
This behavior is already implemented.
* Import these sections as given because they are handled by the YaST code in Agama.

### `keyboard`, `language` and `timezone`

These sections are rather simple, but we need to do some mapping between AutoYaST and Agama values.
Additionally, the `hwclock` element is not present in Agama.

### `networking`

The `networking` section in AutoYaST is composed of several sections: `dns`, `interfaces`,
`net-udev`, `routing` and `s390-devices`. Additionally, other elements like `ipv6` or
`keep_install_network` might need some level of support.

At this point, Agama only supports defining a list of connections that could correspond with the
AutoYaST interfaces list. We might need to extend Agama to support `dns`, `net-udev`, etc.

About `keep_install_network` and `setup_before_proposal`, we should not implement them to keep
things simple.

### `partitioning`

By far, the most complex part of an AutoYaST profile. We can import the AutoYaST `partitioning`
section as it is because the partitioning is handled by the same code in Agama and AutoyaST.

However, we must implement a mechanism to convert to/from both profile types.

### `proxy`

To use a proxy in Agama, you set the `proxy` in the [kernel's command line][cmdline]. In AutoYaST,
you can specify the proxy in the profile apart from the command line.

Although we need to support the same use case, we should avoid introducing a `proxy` section unless
it is strictly required.

[cmdline]: https://github.com/openSUSE/agama/blob/a105391949a914ae57719c80a610c642fb581924/service/lib/agama/proxy_setup.rb#L31

### `report`

The AutoYaST `report` section defines which kind of messages to report (errors, warnings,
information and yes/no messages) and whether the installation should stop on any of them. Agama does
not have an equivalent mechanism. Moreover, it is arguable whether it is a good idea to base on the
type of message to stop the installation. A more fine-grained control over the situations that
should stop the installation would be better. As an example, consider the `signature-handling`
section.

### `scripts`

The only way to use scripts in Agama is to write your own autoinstallation script. Unlike AutoYaST,
you cannot embed the script within the Jsonnet-based profile. This is relevant from the
implementation point of view because we might need to extract AutoYaST scripts and put them in some
place for Agama to run them.

Apart from that, AutoYaST considers five kind of scripts: `pre`, `post-partitioning`, `chroot`,
`post`, and `init`. The last two are expected to run after the first boot, where Agama is not
present anymore.

If we want to support `post` or `init` scripts, we need to copy them to the installed system and run
them through a systemd service.

### `software`

The `software` section is composed of several lists:

* A list of products to install, although a single value is expected.
* A list of patterns to install, a list of patterns to install in the 2nd stage and a list of
patterns to remove.
* A list of packages to install, a list of packages to install in the 2nd stage and a list of
packages to remove.

Additionally, it is possible to force the installation of a specific kernel (`kernel`), perform
an online update at the end of the installation (`do_online_update`) or enable/disable the
installation of recommended packages (`install_recommended`).

Only the product and the list of products or patterns are available for Agama. We might consider
adding support for the packages list and the `install_recommended` setting, although none are in the
web UI.

### `suse_register`

Basic support for registering in the SUSE Customer Center is already in place, although
there is no way to select the list of add-ons.

It is arguable whether we should offer a `install_updates` element instead of just installing them
(which is the use case for not installing them?).

About the `slp_discoverty` element, Agama does not support [SLP] at all?

[SLP]: https://documentation.suse.com/sles/15-SP5/single-html/SLES-administration/#cha-slp

## Unsupported sections

* `FCoE`
* `add-on`
* `audit-laf`
* `auth-client`
* `configuration_management`
* `deploy_image`
* `dhcp-server`
* `dns-server`
* `files`
* `firstboot`
* `ftp-server`
* `groups`
* `host`
* `http-server`
* `mail`
* `nfs`
* `nfs_server`
* `nis`
* `nis_server`
* `ntp-client`
* `printer`
* `samba-client`
* `services-manager`
* `sound`
* `squid`
* `ssh_import`
* `sysconfig`
* `tftp-server`
* `upgrade`
