# AutoYaST Support

Agama offers a mechanism to perform [unattended installations](./unattended). However, we
would like AutoYaST users to be able to use their profiles in Agama. This document describes how
Agama could support, to some extent, such profiles.

Bear in mind that it is a living document and our plans could change as we progress.

## What to support

We want to point out that Agama and AutoYaST have different features. Agama is focused on the
installation and delegates further configuration to other tools. From this point of view, it is
clear that many of the sections you can find in an AutoYaST profile will not have an Agama
counterpart.

Nevertheless, we want to cover:

- Dynamic profiles, including rules/classes, ERB templates, pre-installation scripts and even "ask
  lists". See [Dynamic profiles](#dynamic-profiles).
- Compatibility (partial or full) for the following sections: `networking`, `partitioning`,
  `language`, `timezone`, `keyboard`, `software`, `scripts`, `users`, `iscsi-client`, `proxy` and
  `suse_register`. See [Supported sections](#supported-sections).

We still need to decide how to handle other sections like `firewall`, `bootloader`, `report`,
`general` or even some elements from `security` or `kdump`.

Finally, we plan to "ignore" many other sections (e.g., all \*-server elements) and sysconfig-like
elements. See [Unsupported sections](#unsupported-sections).

## Dynamic profiles

Many AutoYaST users rely on its dynamic capabilities to build adaptable profiles that they can use
to install different systems. For that reason, we need Agama to support these features:

- [Rules and classes][rules-classes].
- [Embedded Ruby (ERB)][erb].
- [Pre-installation scripts][pre-scripts].
- Ask lists.

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
[run][ask-list-runner] the process are there but we need to adapt the
[user interface][ask-list-dialog], which is not trivial.

[rules-classes]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/rulesandclass.html
[erb]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/erb-templates.html
[pre-scripts]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/cha-configuration-installation-options.html#pre-install-scripts
[ask-lists]: https://doc.opensuse.org/documentation/leap/autoyast/html/book-autoyast/cha-configuration-installation-options.html#CreateProfile-Ask
[autoyast-branch]: https://github.com/openSUSE/agama/tree/import-autoyast-profiles
[ask-list-reader]: https://github.com/yast/yast-autoinstallation/blob/c2dc34560df4ba890688a0c84caec94cc2718f14/src/lib/autoinstall/ask/profile_reader.rb#L29
[ask-list-runner]: https://github.com/yast/yast-autoinstallation/blob/c2dc34560df4ba890688a0c84caec94cc2718f14/src/lib/autoinstall/ask/runner.rb#L50
[ask-list-dialog]: https://github.com/yast/yast-autoinstallation/blob/c2dc34560df4ba890688a0c84caec94cc2718f14/src/lib/autoinstall/ask/dialog.rb#L23

## Supported sections

Let's describe which sections and elements from an AutoYaST profile are (or will be) supported in
Agama. In some cases, you might find a table with the following columns:

- AutoYaST: name of the AutoYaST element.
- Supported: whether it is (or will be) supported. The meaning of each value is:
  - Yes: fully supported.
  - Planned: not supported yet, but there are plans to support it.
  - Undecided: no decision about whether it should be supported.
  - No: there are not plans for supporting that element.
- Agama: name of the Agama element.
- Comment: any comment or reason about the element.

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

- Extract the root authentication data from the profile and try to infer which is the first user.
  This behavior is already implemented.
- Import these sections as given because they are handled by the YaST code in Agama.

| AutoYaST | Supported | Agama | Comment                                      |
| -------- | --------- | ----- | -------------------------------------------- |
| groups   | No        |       | It is not planned, but we should consider    |
| users    | No        |       | It is not planned, but we should consider    |
|          |           | root  | Root user (only password and SSH public key) |
|          |           | user  | First non-system user from "users"           |

For the first user, the following elements are supported:

| AutoYaST             | Supported | Agama    | Comment                |
| -------------------- | --------- | -------- | ---------------------- |
| authorized_keys      | Planned   |          | Only for the root user |
| encrypted            | Planned   |          |                        |
| forename             | No        |          |                        |
| fullname             | Yes       | fullName |                        |
| gid                  | No        |          |                        |
| group                | No        |          |                        |
| groups               | No        |          |                        |
| home                 | No        |          |                        |
| home_btrfs_subvolume | No        |          |                        |
| password_settings    | No        |          |                        |
| shell                | No        |          |                        |
| surname              | No        |          |                        |
| uid                  | No        |          |                        |
| user_password        | Yes       | password |                        |
| username             | Yes       | userName |                        |

### `keyboard`

Only the `keymap` element is translated. The rest of options are ignored in YaST and they are not
even documented in the AutoYaST handbook.

| AutoYaST | Supported | Agama         | Comment                        |
| -------- | --------- | ------------- | ------------------------------ |
| keymap   | Yes       | l10n.keyboard | Should we rename it to keymap? |
| capslock | No        |               | Deprecated                     |
| delay    | No        |               | Deprecated                     |
| discaps  | No        |               | Deprecated                     |
| numlock  | No        |               | Deprecated                     |
| rate     | No        |               | Deprecated                     |
| scrlock  | No        |               | Deprecated                     |
| tty      | No        |               | Deprecated                     |

### `language`

| AutoYaST  | Supported | Agama          | Comment                   |
| --------- | --------- | -------------- | ------------------------- |
| language  | Yes       | l10n.languages | First element of the list |
| languages | Yes       | l10n.languages |                           |

### `networking`

The `networking` section in AutoYaST is composed of several sections: `dns`, `interfaces`,
`net-udev`, `routing` and `s390-devices`. At this point, Agama only supports defining a list of
connections that could correspond with the AutoYaST interfaces list. We might need to extend Agama
to support `dns`, `net-udev`, etc.

| AutoYaST                | Supported | Agama       | Comment                            |
| ----------------------- | --------- | ----------- | ---------------------------------- |
| backend                 | No        |             | No plan for additional backends    |
| dhcp_options            | No        |             |                                    |
| dns                     | Partial   |             | Included in connections            |
| interfaces              | Partial   | connections | Check the connections table below  |
| ipv6                    | Yes       |             | It affects `method4` and `method6` |
| keep_install_network    | No        |             |                                    |
| managed                 | No        |             |                                    |
| modules                 | No        |             |                                    |
| net-udev                | No        |             |                                    |
| routing                 | Planned   |             |                                    |
| s390-devices            | Planned   |             |                                    |
| setup_before_proposal   | No        |             |                                    |
| strict_IP_check_timeout | No        |             |                                    |
| virt_brige_proposal     | No        |             |                                    |

As seen in the table above, AutoYaST `interfaces` corresponds with Agama `connections`, but the
format is not exactly the same.

| AutoYaST                   | Supported | Agama       | Comment                                 |
| -------------------------- | --------- | ----------- | --------------------------------------- |
| device                     | Yes       | interface   |                                         |
| name                       | Yes       | id          |                                         |
| description                | No        |             |                                         |
| bootproto                  | Partial   | method{4,6} | Different set of values                 |
| startmode                  | No        |             | Do not set up connections you won't use |
| lladdr                     | Yes       | macAddress  |                                         |
| ifplugd_priority           | No        |             | Not relevant (no ifplugd support)       |
| usercontrol                | No        |             |                                         |
| dhclient_set_hostname      | No        |             |                                         |
| ipaddr                     | Yes       | addresses   |                                         |
| prefixlen                  | Yes       | addresses   | Part of `addresses`                     |
| remote_ipaddr              | Undecided |             |                                         |
| netmask                    | Yes       | addresses   | Part of `addresses`                     |
| bonding\_\*                | Yes       | bond        | Use a different format to define bonds  |
| aliases                    | Yes       |             | Part of `addresses`                     |
| broadcast                  | No        |             | Part of `addresses`                     |
| network                    | No        |             | Part of `addresses`                     |
| mtu                        | Undecided |             |                                         |
| ethtool_options            | Undecided |             |                                         |
| wireless                   | Yes       | wireless    | It uses a different format              |
| wifi_settings              | Partial   | wireless    | It uses a different format              |
| bridge_settings            | Planned   |             |                                         |
| vlan_settings              | Planned   |             |                                         |
| dhclient_set_down_link     | No        |             |                                         |
| dhclient_set_default_route | No        |             |                                         |
| zone                       | No        |             |                                         |
| firewall                   | No        |             |                                         |

#### Wireless connections

Setting up a wireless connection in AutoYaST is not even documented, although it is possible. In
Agama, the options are placed under a `wireless` key.

| AutoYaST                     | Supported | Agama    | Comment                 |
| ---------------------------- | --------- | -------- | ----------------------- |
| wireless_auth_mode           | Partial   | security | Different set of values |
| wireless_ap                  | Undecided |          |                         |
| wireless_bitrate             | Undecided |          |                         |
| wireless_ca_cert             | Undecided |          |                         |
| wireless_channel             | Undecided |          |                         |
| wireless_client_cert         | Undecided |          |                         |
| wireless_client_key          | Undecided |          |                         |
| wireless_client_key_password | Undecided |          |                         |
| wireless_default_key         | Undecided |          |                         |
| wireless_eap_auth            | Undecided |          |                         |
| wireless_eap_mode            | Undecided |          |                         |
| wireless_essid               | Yes       | ssid     |                         |
| wireless_frequency           | Undecided |          |                         |
| wireless_key                 | Undecided |          |                         |
| wireless_key_0               | Undecided |          |                         |
| wireless_key_1               | Undecided |          |                         |
| wireless_key_2               | Undecided |          |                         |
| wireless_key_3               | Undecided |          |                         |
| wireless_key_length          | Undecided |          |                         |
| wireless_mode                | Partial   | mode     | Different set of values |
| wireless_nick                | No        |          |                         |
| wireless_nwid                | No        |          |                         |
| wireless_peap_version        | No        |          |                         |
| wireless_power               | No        |          |                         |
| wireless_wpa_anonid          | No        |          |                         |
| wireless_wpa_identity        | No        |          |                         |
| wireless_wpa_password        | Yes       | password |                         |
| wireless_wpa_psk             | Yes       | password |                         |

#### Bonding connections

The AutoYaST `bonding*` elements allow setting up a bonding interface. In Agama, those settings are
placed under a `bond` key in the `connection` structure.

| AutoYaST            | Supported | Agama   | Comment                       |
| ------------------- | --------- | ------- | ----------------------------- |
| bonding_master      | Yes       |         | The master defines the `bond` |
| bonding_slaveX      | Yes       | ports   |                               |
| bonding_module_opts | Yes       | options |                               |
| -                   |           | mode    | Specific key to set the mode  |

Agama includes an specific `mode` options to set the mode, instead of abusing the
`bonding_module_opts`.

### Bridge connections

> [!WARNING]
> Bridge support is not implemented yet, although we have support at model level.

The AutoYaST `bridge*` elements allow setting up a bridge. In Agama, those settings are placed under
a `bridge` key in the `connection` structure.

| AutoYaST             | Supported | Agama         | Comment                                 |
| -------------------- | --------- | ------------- | --------------------------------------- |
| bridge               | Planned   |               | An existing `bridge` key means the same |
| bridge_ports         | Planned   | ports         |                                         |
| bridge_stp           | Planned   | stp           |                                         |
| bridge_forward_delay | Planned   | forward_delay |                                         |
| bridge_forwarddelay  | Planned   | forward_delay | Compatibility bsc#1180944               |

### VLAN

> [!WARNING]
> VLAN support is not implemented yet, although we have support at model level.

The AutoYaST `vlan_settings` elements allow setting up a bridge. In Agama, those settings are placed
under a `vlan` key in the `connection` structure.

| AutoYaST    | Supported | Agama    | Comment |
| ----------- | --------- | -------- | ------- |
| vlan_id     | Planned   | id       |         |
| etherdevice | Planned   | parent   |         |
| -           | Planned   | protocol |         |

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

- A list of products to install, although a single value is expected.
- A list of patterns to install, a list of patterns to install in the 2nd stage and a list of
  patterns to remove.
- A list of packages to install, a list of packages to install in the 2nd stage and a list of
  packages to remove.

Additionally, it is possible to force the installation of a specific kernel (`kernel`), perform an
online update at the end of the installation (`do_online_update`) or enable/disable the installation
of recommended packages (`install_recommended`).

Only the product and the list of products or patterns are available for Agama. We might consider
adding support for the packages list and the `install_recommended` setting, although none are in the
web UI.

| AutoYaST            | Supported | Agama             | Comment                           |
| ------------------- | --------- | ----------------- | --------------------------------- |
| do_online_update    | No        |                   | No 2nd stage                      |
| install_recommended | No        |                   |                                   |
| instsource          | No        |                   |                                   |
| kernel              | No        |                   |                                   |
| packages            | No        |                   |                                   |
| patterns            | Partial   | software.patterns | No support for regular expresions |
| post-packages       | No        |                   | No 2nd stage                      |
| post-patterns       | No        |                   | No 2nd stage                      |
| products            | Yes       | software.id       |                                   |
| remove-packages     | No        |                   | No upgrade                        |
| remove-patterns     | No        |                   | No upgrade                        |
| remove-products     | No        |                   | No upgrade                        |

### `suse_register`

Basic support for registering in the SUSE Customer Center is already in place, although there is no
way to select the list of add-ons.

It is arguable whether we should offer a `install_updates` element instead of just installing them
(which is the use case for not installing them?).

About the `slp_discoverty` element, Agama does not support [SLP] at all?

[SLP]: https://documentation.suse.com/sles/15-SP5/single-html/SLES-administration/#cha-slp

| AutoYaST                         | Supported | Agama                     | Comment                              |
| -------------------------------- | --------- | ------------------------- | ------------------------------------ |
| do_registration                  | Yes       |                           | The section is ignored if `false`    |
| email                            | Yes       | product.registrationEmail |                                      |
| install_updates                  | Never     |                           |                                      |
| reg_code                         | Yes       | product.registrationCode  |                                      |
| reg_server                       | Planned   |                           |                                      |
| reg_server_cert                  | Planned   |                           |                                      |
| reg_server_cert_fingerprint      | Planned   |                           |                                      |
| reg_server_cert_fingerprint_type | Planned   |                           |                                      |
| addons                           | Undecided |                           | It is not clear how addons will work |
| slp_discovery                    | No        |                           |                                      |

### `timezone`

| AutoYaST | Supported | Agama         | Comment |
| -------- | --------- | ------------- | ------- |
| timezone | Yes       | l10n.timezone |         |
| hwclock  | No        |               |         |

## Unsupported sections

- `FCoE`
- `add-on`
- `audit-laf`
- `auth-client`
- `configuration_management`
- `deploy_image`
- `dhcp-server`
- `dns-server`
- `files`
- `firstboot`
- `ftp-server`
- `groups`
- `host`
- `http-server`
- `mail`
- `nfs`
- `nfs_server`
- `nis`
- `nis_server`
- `ntp-client`
- `printer`
- `samba-client`
- `services-manager`
- `sound`
- `squid`
- `ssh_import`
- `sysconfig`
- `tftp-server`
- `upgrade`
