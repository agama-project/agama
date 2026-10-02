# Vendored YaST/AutoYaST code

This directory contains a **permanent fork** of a small set of Ruby classes originally provided by
the `autoyast2` (`autoyast2-installation`), `yast2-installation`, `yast2-network` and `yast2-s390`
YaST packages. Agama no longer depends on those RPMs; the classes it still needs from them have been
copied here instead.

There is **no process to keep this code in sync with upstream YaST releases**. If a bug is found
here, or a new AutoYaST/DASD/zFCP feature is needed, fix/extend the code directly in this directory;
do not expect it to be updated automatically from `yast-autoyast2`, `yast-installation`,
`yast-network` or `yast-s390`.

## Tests

Being the sole maintainer of this code means Agama also owns its test coverage. `service/test/YaST2/`
mirrors this directory's layout and contains tests ported from the original upstream test suites
(`autoyast2-installation`'s, `yast2-installation`'s, `yast2-network`'s and `yast2-s390`'s `test/`
directories), adapted to run against the vendored copies here instead of an installed RPM. Fixtures
they need live under `service/test/fixtures/yast2/`. As with the production code, there is no process
to pull in new upstream test examples automatically - extend these tests directly when the vendored
code changes.

A handful of `y2network` value classes (`startmode.rb`, `startmodes.rb` and its six concrete
subclasses, `wireless_mode.rb`) have no upstream test at all (only interactive-UI widget tests
exist for them) - their tests under `service/test/YaST2/lib/y2network/` were written from scratch
instead of ported.

`y2s390/hwinfo_reader.rb` likewise has no upstream test at all (not even an interactive-UI one) -
its test under `service/test/YaST2/lib/y2s390/hwinfo_reader_test.rb` was written from scratch.

Upstream `yast2-s390` tests mock hardware-probing data via two environment variables
(`S390_MOCKING=1`, which points at a hardcoded `test/data/*.yml`/`.txt` path relative to the
process's current working directory, or `YAST2_S390_LSDASD`/`YAST2_S390_PROBE_DISK`, which point at
an arbitrary file). The production code (`dasds_reader.rb`, `hwinfo_reader.rb`) was vendored
unchanged, including this mechanism - but the **ported tests** deliberately avoid relying on the
CWD-relative `S390_MOCKING` path (fragile given Agama's different working-directory/test-layout
conventions) and instead stub the relevant methods directly (`Y2S390::HwinfoReader.instance`'s
`for_device`/`disks`, `DasdsReader#dasd_entries`) using fixtures loaded through the standard
`FIXTURES_PATH` convention. This exercises the same production code paths without depending on
process CWD.

### Known limitations (found while writing tests, not fixed)

- `InterfaceSection#init_from_config` and `S390DeviceSection#init_from_config`
  (`.new_from_network` code path) unconditionally reference `Y2Network::ConnectionConfig`, which is
  not vendored. Calling `.new_from_network` on these two classes therefore always raises
  `NameError`. This is not a problem in practice: `.new_from_network` builds a profile section
  *from* a live network config (used by AutoYaST profile cloning), the opposite direction of what
  Agama does (`.new_from_hashes`, building Agama's config *from* a profile) - grep confirms nothing
  under `service/lib/` ever calls `.new_from_network` on these classes. Worth knowing if that ever
  changes.
- `Startmodes::Ifplugd#==` is overridden to compare `name`+`priority`, but the inherited `#eql?`/
  `#hash` (from `Yast2::Equatable`) only consider `name`. Two instances with different `priority`
  are therefore `!=` but `#eql?` and share the same `#hash`, which breaks the usual Ruby `==`/`hash`
  contract (could cause incorrect de-duplication in a `Hash`/`Set`). Also, `Ifplugd#==` raises
  `NoMethodError` instead of returning `false` when compared against `nil` or anything without a
  `.name` method. Both are pre-existing upstream bugs (confirmed identical in current
  `yast2-network` master), not something introduced by vendoring.
- `WirelessMode::AD_HOC`'s human-readable string is "Add-hoc" (extra "d"), presumably meant to be
  "Ad-hoc". Cosmetic, pre-existing upstream, not fixed.

## Layout

This mirrors the relevant parts of the upstream source trees so it stays easy to compare against the
original code if needed:

- `modules/` - classes that are loaded through `Yast.import "X"` (the classic YaST module
  mechanism). This directory is added to `ENV["Y2DIR"]` by `bin/agama-autoyast` (the same mechanism
  already used by `service/lib/agama/y2dir` to override `Yast::Package` and
  `Yast::PackagesProposal`), so `Yast.import "AutoinstConfig"` and friends resolve here
  automatically without any changes to the code that uses them.
- `lib/` - classes loaded through plain `require`. This directory is added to the gem's
  `require_paths` (see `agama-yast.gemspec`), so `require "installation/unmounter"` and similar
  calls resolve here automatically.
- `include/` - legacy YCP-era `Yast.include self, "..."` files. Like `modules/`, these are resolved
  through `Y2DIR`.
- `xslt/` - static, non-Ruby support files (currently just the third-party `merge.xslt` stylesheet
  used to merge `<rules>`/`<classes>` profiles). These are not loaded through
  `Y2DIR`/`require_paths` at all: `AutoInstallRules.rb` resolves the path to `merge.xslt` relative
  to its own location (`File.expand_path("../../xslt/merge.xslt", __dir__)`), which works the same
  way whether running from a git checkout, in tests, or from an installed gem, since the
  `modules/`/`xslt/` sibling layout is preserved either way. There is no `install.sh`/RPM step
  involved for this file beyond it being part of `spec.files` in `agama-yast.gemspec`.

## Vendored classes

| File                                                                                                                                                                                       | Originally from                                                                                             | Notes                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/AutoinstConfig.rb`                                                                                                                                                                | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstConfig.rb`)                                 | AutoYaST global configuration (profile URL, temp dirs, etc.)                                                                                                                                                                                                                                                    |
| `modules/AutoinstScripts.rb`                                                                                                                                                               | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstScripts.rb`)                                | Collects and runs `<scripts>`                                                                                                                                                                                                                                                                                   |
| `modules/Profile.rb`                                                                                                                                                                       | `autoyast2-installation` (`autoinstallation/src/modules/Profile.rb`)                                        | `Yast::Profile` and `Yast::ProfileHash`, the in-memory profile representation                                                                                                                                                                                                                                   |
| `modules/ProfileLocation.rb`                                                                                                                                                               | `autoyast2-installation` (`autoinstallation/src/modules/ProfileLocation.rb`)                                | Fetches the profile from its configured location (URL, rules/classes, etc.)                                                                                                                                                                                                                                     |
| `modules/AutoInstallRules.rb`                                                                                                                                                              | `autoyast2-installation` (`autoinstallation/src/modules/AutoInstallRules.rb`)                               | `<rules>`/`<classes>` matching engine. Requires `xslt/merge.xslt` (see below)                                                                                                                                                                                                                                   |
| `modules/AutoinstFunctions.rb`                                                                                                                                                             | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstFunctions.rb`)                              | Base-product detection, used by `Profile#check_version` during profile import                                                                                                                                                                                                                                   |
| `modules/ServicesManagerTarget.rb`                                                                                                                                                         | `yast2-services-manager` (`services-manager/src/modules/services_manager_target.rb`)                        | Only `ServicesManagerTargetClass::BaseTargets` (a target-name/translation lookup table) is used, by `AutoinstConfig`; the rest of the class (reading/writing the systemd default target) is unused dead code, kept only because `Yast.import "ServicesManagerTarget"` needs the whole file to load successfully |
| `include/autoinstall/xml.rb`                                                                                                                                                               | `autoyast2-installation` (`autoinstallation/src/include/autoinstall/xml.rb`)                                | XML doc-type setup (`profileSetup`/`classSetup`) used while parsing the profile; loaded via `Yast.include self, "autoinstall/xml.rb"` from `AutoinstConfig.rb`                                                                                                                                                  |
| `include/autoinstall/io.rb`                                                                                                                                                                | `autoyast2-installation` (`autoinstallation/src/include/autoinstall/io.rb`)                                 | `Get`/`GetURL` helpers on top of `lib/transfer/file_from_url.rb`; loaded via `Yast.include self, "autoinstall/io.rb"` from `AutoinstConfig.rb`                                                                                                                                                                  |
| `xslt/merge.xslt`                                                                                                                                                                          | `autoyast2-installation` (`autoinstallation/xslt/merge.xslt`, third-party LGPL stylesheet by Oliver Becker) | Merges two profile XML documents; invoked by `AutoInstallRules.rb` via `xsltproc`, resolved relative to `AutoInstallRules.rb`'s own location. Not loaded as Ruby code                                                                                                                                           |
| `lib/autoinstall/script.rb`                                                                                                                                                                | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/script.rb`)                                 | `Y2Autoinstallation::Script` and subclasses (`PreScript`, `PostScript`, etc.)                                                                                                                                                                                                                                   |
| `lib/autoinstall/script_runner.rb`                                                                                                                                                         | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/script_runner.rb`)                          | Runs `ExecutedScript` instances                                                                                                                                                                                                                                                                                 |
| `lib/autoinstall/xml_checks.rb`                                                                                                                                                            | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/xml_checks.rb`)                             | Validates the profile XML against the AutoYaST schema                                                                                                                                                                                                                                                           |
| `lib/autoinstall/xml_validator.rb`                                                                                                                                                         | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/xml_validator.rb`)                          | Generic RNG validation helper used by `xml_checks.rb`                                                                                                                                                                                                                                                           |
| `lib/autoinstall/y2erb.rb`                                                                                                                                                                 | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/y2erb.rb`)                                  | Renders ERB profiles, exposing hardware info to the template                                                                                                                                                                                                                                                    |
| `lib/autoinstall/entries/registry.rb`                                                                                                                                                      | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/entries/registry.rb`)                       | Used by `Profile#merge_resource_aliases!`; in practice returns no aliases now that the `.desktop` files that used to describe them are no longer installed                                                                                                                                                      |
| `lib/autoinstall/entries/description.rb`                                                                                                                                                   | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/entries/description.rb`)                    | Support class for `registry.rb`                                                                                                                                                                                                                                                                                 |
| `lib/transfer/file_from_url.rb`                                                                                                                                                            | `yast2-installation` (`installation/src/lib/transfer/file_from_url.rb`)                                     | Fetches a pre-script when it uses a `location` URL instead of inline `source` text                                                                                                                                                                                                                              |
| `lib/installation/unmounter.rb`                                                                                                                                                            | `yast2-installation` (`installation/src/lib/installation/unmounter.rb`)                                     | Unmounts the target system at the end of the installation                                                                                                                                                                                                                                                       |
| `lib/installation/clients/umount_finish.rb`                                                                                                                                                | `yast2-installation` (`installation/src/lib/installation/clients/umount_finish.rb`)                         | Wraps `Installation::Unmounter` plus some extra target cleanup                                                                                                                                                                                                                                                  |
| `lib/installation/cio_ignore.rb`                                                                                                                                                           | `yast2-installation` (`installation/src/lib/installation/cio_ignore.rb`)                                    | s390 `cio_ignore`/`rd.zdev` kernel parameter handling. The UI-only `Installation::CIOIgnoreProposal` class was dropped, Agama does not use the interactive AutoYaST/YaST UI                                                                                                                                     |
| `lib/y2network/autoinst_profile/networking_section.rb`                                                                                                                                     | `yast2-network` (`network/src/lib/y2network/autoinst_profile/networking_section.rb`)                        | Parses the `<networking>` AutoYaST section                                                                                                                                                                                                                                                                      |
| `lib/y2network/autoinst_profile/{dns,interfaces,interface,alias}_section.rb`                                                                                                               | `yast2-network`                                                                                             | Sub-sections of `<networking>`: DNS, interfaces and per-interface attributes (including bonding/bridge/VLAN/wireless, consumed by Agama's own `bond_reader.rb`/`bridge_reader.rb`/`vlan_reader.rb`/`wireless_reader.rb`)                                                                                        |
| `lib/y2network/autoinst_profile/{routing,route}_section.rb`, `{udev_rules,udev_rule}_section.rb`, `{s390_devices,s390_device}_section.rb`                                                  | `yast2-network`                                                                                             | Not read by any of Agama's readers today, but load-bearing: `NetworkingSection.new_from_hashes` unconditionally instantiates them when the corresponding profile keys (`routing`, `net-udev`, `s390-devices`) are present                                                                                       |
| `lib/y2network/boot_protocol.rb`, `ip_address.rb`, `startmode.rb`, `startmodes.rb`, `startmodes/{auto,hotplug,ifplugd,manual,nfsroot,off}.rb`, `wireless_auth_mode.rb`, `wireless_mode.rb` | `yast2-network`                                                                                             | Value/enum classes used while reading interface attributes. Unlike everything above, this whole closure has **no** `Yast.import` calls at all - plain `require` only                                                                                                                                            |
| `lib/y2s390.rb`                                                                                                                                                                            | `yast2-s390` (`src/lib/y2s390.rb`)                                                                           | Aggregator requiring `dasd.rb`, `dasds_reader.rb`, `dasds_collection.rb`, `hwinfo_reader.rb`, in that order (`dasd.rb` relies on `hwinfo_reader.rb` having already been loaded, same as upstream)                                                                                                                |
| `lib/y2s390/dasd.rb`                                                                                                                                                                       | `yast2-s390` (`src/lib/y2s390/dasd.rb`)                                                                     | `Y2S390::Dasd`, a single DASD device (status, type, partition info, hwinfo-derived access type)                                                                                                                                                                                                                  |
| `lib/y2s390/dasds_reader.rb`                                                                                                                                                               | `yast2-s390` (`src/lib/y2s390/dasds_reader.rb`)                                                             | `Y2S390::DasdsReader`, parses `lsdasd`/`dasdview` output into `Y2S390::Dasd` instances                                                                                                                                                                                                                            |
| `lib/y2s390/dasds_collection.rb`                                                                                                                                                           | `yast2-s390` (`src/lib/y2s390/dasds_collection.rb`)                                                         | `Y2S390::DasdsCollection`, filtering helpers (`active`, `offline`, `unformatted`, `to_format`) on top of `BaseCollection`                                                                                                                                                                                         |
| `lib/y2s390/base_collection.rb`                                                                                                                                                            | `yast2-s390` (`src/lib/y2s390/base_collection.rb`)                                                          | `Y2S390::BaseCollection`, generic add/delete/by\_id collection base class                                                                                                                                                                                                                                         |
| `lib/y2s390/hwinfo_reader.rb`                                                                                                                                                              | `yast2-s390` (`src/lib/y2s390/hwinfo_reader.rb`)                                                            | `Y2S390::HwinfoReader`, a singleton caching `.probe.disk` hardware-probing data, looked up by sysfs bus ID                                                                                                                                                                                                        |
| `lib/y2s390/format_process.rb`                                                                                                                                                             | `yast2-s390` (`src/lib/y2s390/format_process.rb`)                                                           | `Y2S390::FormatProcess`/`FormatStatus`, drives and tracks the async `dasdfmt` process used to format DASD volumes                                                                                                                                                                                                 |
| `lib/y2s390/zfcp.rb`                                                                                                                                                                       | `yast2-s390` (`src/lib/y2s390/zfcp.rb`)                                                                     | `Y2S390::ZFCP`, probes zFCP controllers/disks and activates/deactivates them via `zfcp_host_configure`/`zfcp_disk_configure`/`zfcp_san_disc`                                                                                                                                                                      |

`Installation::FinishClient` (the common base class for finish steps), `Y2Storage::Clients::Finish`
/ `Y2IscsiClient::FinishClient` (the storage/iSCSI finish steps), and
`installation/autoinst_profile/{section_with_attributes,element_path}.rb` (required by every
`y2network/autoinst_profile/*_section.rb` file above) are **not** vendored here: they are provided
by the `yast2`, `yast2-storage-ng` and `yast2-iscsi-client` packages, which remain real runtime
dependencies of Agama.

**`yast2-s390`'s UI/classic-module layer is not vendored.** `dasds_writer.rb`, `dasd_actions/*.rb`,
`presenters/dasd_summary.rb`, the `dialogs/`/`include/` tree and the classic `modules/
DASDController.rb`/`modules/ZFCPController.rb` modules are all interactive-UI-only or only reachable
from them - Agama's own `service/lib/agama/storage/dasd/`, `service/lib/agama/storage/zfcp/` drive
DASD/zFCP configuration directly through the lower-level classes vendored above (`Dasd`,
`DasdsCollection`, `DasdsReader`, `FormatProcess`, `ZFCP`), not through `DasdsWriter`/`DasdActions`.

**`yast2-users` is not vendored at all.** `Y2Users::User` unconditionally requires a chain that ends
in `Yast.import "UsersSimple"`, a Perl module that only exists inside `yast2-users` itself, so
merely loading the class would hard-crash without that package installed - for functionality
(password/account validation) Agama never uses. Given Agama only reads a handful of plain fields
from the raw profile hash (root/first regular user's name, password, and SSH keys),
`service/lib/agama/autoyast/users_profile_reader.rb` reads the `<users>` section directly instead.
The one piece of behavior it does replicate from `Y2Users::User#system?` - treating a user with a
low enough explicit uid as a "system" user - reuses `Yast::ShadowConfig`, which lives in the base
`yast2` package (not `yast2-users`), so it adds no dependency either.
