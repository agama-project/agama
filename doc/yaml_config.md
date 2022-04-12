YaML Config
-----------

Why YaML
========

With our previous experience we discard at the start XML due to its poor readability.
JSON format we also consider has serious disadvantage - lack of comments.
So we decide to go with YaML which is still comfortable to read and also machine read.
Only disadvantage we found is lack of mature schema support for YaML.

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

### distros

List of supported distros that can be offered in installer.

### conditions

List of specific conditions. Conditions are specific keys that based on data can modify
installatio config like distro or arch specific options. If multiple conditions
are specified like arch and distro together, then both have to be satisfied.
Below are possible keys.

#### distro

List of distros for which condition apply. Any of it can apply. Possible keys are from list
supported distros in software section. TODO: regex of glob support?

#### arch

List of architectures where apply condition.

#### value

map with same structure as top level config element that overwrites default values. Only exception
is conditions which cannot be nested.
