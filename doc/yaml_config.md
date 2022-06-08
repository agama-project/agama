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

Array of url for installation repositories.

#### mandatory\_patterns

Array of patterns that have to be selected.

#### optional\_patterns

Array of patterns that should be selected but can be deselected or skipped if not available.

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


#### selinux\_policy

Default policy for selinux. It is ignored if lsm is not selinux.

### distributions

List of supported distros that can be offered in installer.

### conditions

List of specific conditions. Conditions are specific keys that based on data can modify
installation config like distro or arch specific options. If multiple conditions
are specified like arch and distro together, then both have to be satisfied.
Below are possible keys.

#### distribution

List of distros for which condition apply. Any of them can apply. Possible keys are from list
supported distros in software section. TODO: regex of glob support?

#### arch

List of architectures where apply condition.

#### value

map with same structure as top level config element that overwrites default values. Only exception
is conditions which cannot be nested.

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
