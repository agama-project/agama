YAML Config
-----------

Why YAML
========

With our previous experience we discard at the start XML due to its poor readability.
JSON format we also consider has serious disadvantage - lack of comments.
So we decide to go with YAML which is still comfortable to read and also machine read.
Only disadvantage we found is lack of mature schema support for YAML.

Rules for Config
================

1. No default values in code. All values have to be defined in yaml config.
2. No objects, just built-in data types.

Structure
=========

Top level config element is map. Each key is described here in following sections.

### software

Software manager related options. It is map with following keys:

#### installation\_repositories

Array of url for installation repositories. Map can be used instead of string.
In such case map should contain url and archs keys. Archs key is used to limit
usage of repository on matching hardware architectures.

#### mandatory\_patterns

Array of patterns that have to be selected.

#### optional\_patterns

Array of patterns that should be selected but can be deselected or skipped if not available.

#### user\_patterns

Array of patterns that are displayed in the pattern selector UI and user can
select them to install.

If the list is empty then the pattern selector is not displayed. If the key is
not defined or the value is missing or is `null` then all available user visible
patterns are displayed.

### security

Options related to security

#### lsm

Default linux security module. Currently supported values are `selinux`, `apparmor` and `none`.

#### available\_lsms

Map for available linux security modules. If only one module is
available it means that lsm is not configurable.

##### patterns

Required patterns for given lsm to be selected.

##### policy

Default policy. Only applicable for selinux lsm.


### distributions

List of supported distros that can be offered in installer. Archs key is used
for products that is not available for all hardware architectures.

### web

Cockpit's web server related settings.

#### ssl

Whether enable or disable TLS/SSL for remote connections. If it is not set, it does not modify
Cockpit configuration in that regard.

#### ssl\_cert

Location of the certificate to use for remote connections. The certificate is retrieved and copied
to `/etc/cockpit/ws-certs.d`.

#### ssl\_key

Location of the certificate key to use for remote connections. The key is retrieved and copied to
`/etc/cockpit/ws-certs.d`. This option is ignored unless the `ssl_cert` is set.

## storage

Options related to management of storage devices. It is map with the following keys:

### volumes

List of volumes used by the proposal. Each volume contains the very same fields described at the
[corresponding section](https://github.com/yast/yast-installation/blob/master/doc/control-file.md#the-volumes-subsection)
of the YaST configuration.
