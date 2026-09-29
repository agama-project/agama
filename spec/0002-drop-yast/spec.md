# Feature: remove YaST dependencies

## Context

Agama replaces YaST as installer. However, it is still relying on YaST code (the service/ directory
of the Agama repository contains the Ruby code that relies on YaST). YaST is composed by a lot of
interdependant small packages and we need to include many of them in the installation medium, even
if they are not used by Agama.

Currently, Agama uses the following YaST parts:

- Storage handling (Y2Storage and friends), including DASD, zFCP, iSCSI and bootloader configuration.
- AutoYaST profiles handling. The `agama-autoyast` executable relies on quite some code to support
  using AutoYaST profiles in Agama. This is where most of the dependencies comes from.

You can check the direct dependencies in the gem2rpm.yml and many of the required packages in the
agama-installer.kiwi file.

### Agama code

The agama code lives in the /home/imobach/SUSE/code/agama repository. The interesting part is in the
service/ directory.

### YaST packages

The repository of the YaST packages is in /home/imobach/SUSE/code/yast. "core" corresponds to
"yast2-core", "bootloader" to "yast2-bootloader", etc. The exceptions are:

- "autotinstallation" -> "autoyast2"
- "yast2", "libstorage-ng", "skelcd-control-leanos", etc. which are not renamed.

## Goal

Removing from the installation media all the YaST code that it is not required by Agama anymore,
reducing the footprint and the maintenance burden. Keep the same list of features.

See plan.md for the architecture analysis and the phased implementation plan.
