# Vendored YaST/AutoYaST code

This directory contains a **permanent fork** of a small set of Ruby classes originally
provided by the `autoyast2` (`autoyast2-installation`) and `yast2-installation` YaST
packages. Agama no longer depends on those RPMs; the classes it still needs from them
have been copied here instead.

See `spec/0002-drop-yast/` at the root of the repository for the rationale and the full
removal plan.

There is **no process to keep this code in sync with upstream YaST releases**. If a bug
is found here, or a new AutoYaST feature is needed, fix/extend the code directly in this
directory; do not expect it to be updated automatically from `yast-autoyast2` or
`yast-installation`.

## Layout

This mirrors the relevant parts of the upstream source trees so it stays easy to compare
against the original code if needed:

- `modules/` - classes that are loaded through `Yast.import "X"` (the classic YaST module
  mechanism). This directory is added to `ENV["Y2DIR"]` by `bin/agama-autoyast` (the same
  mechanism already used by `service/lib/agama/y2dir` to override `Yast::Package` and
  `Yast::PackagesProposal`), so `Yast.import "AutoinstConfig"` and friends resolve here
  automatically without any changes to the code that uses them.
- `lib/` - classes loaded through plain `require`. This directory is added to the gem's
  `require_paths` (see `agama-yast.gemspec`), so `require "installation/unmounter"` and
  similar calls resolve here automatically.
- `include/` - legacy YCP-era `Yast.include self, "..."` files. Like `modules/`, these are
  resolved through `Y2DIR`.
- `xslt/` - static, non-Ruby support files (currently just the third-party `merge.xslt`
  stylesheet used to merge `<rules>`/`<classes>` profiles). These are not loaded through
  `Y2DIR`/`require_paths` at all: `bin/../YaST2/xslt/merge.xslt` is installed by
  `install.sh` at the same absolute path (`/usr/share/autoinstall/xslt/merge.xslt`) the
  vendored `AutoInstallRules.rb` hardcodes, since that's how the original
  `autoyast2-installation` package shipped it too.

## Vendored classes

| File | Originally from | Notes |
|---|---|---|
| `modules/AutoinstConfig.rb` | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstConfig.rb`) | AutoYaST global configuration (profile URL, temp dirs, etc.) |
| `modules/AutoinstScripts.rb` | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstScripts.rb`) | Collects and runs `<scripts>` |
| `modules/Profile.rb` | `autoyast2-installation` (`autoinstallation/src/modules/Profile.rb`) | `Yast::Profile` and `Yast::ProfileHash`, the in-memory profile representation |
| `modules/ProfileLocation.rb` | `autoyast2-installation` (`autoinstallation/src/modules/ProfileLocation.rb`) | Fetches the profile from its configured location (URL, rules/classes, etc.) |
| `modules/AutoInstallRules.rb` | `autoyast2-installation` (`autoinstallation/src/modules/AutoInstallRules.rb`) | `<rules>`/`<classes>` matching engine. Requires `xslt/merge.xslt` (see below) |
| `modules/AutoinstFunctions.rb` | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstFunctions.rb`) | Base-product detection, used by `Profile#check_version` during profile import |
| `include/autoinstall/xml.rb` | `autoyast2-installation` (`autoinstallation/src/include/autoinstall/xml.rb`) | XML doc-type setup (`profileSetup`/`classSetup`) used while parsing the profile; loaded via `Yast.include self, "autoinstall/xml.rb"` from `AutoinstConfig.rb` |
| `include/autoinstall/io.rb` | `autoyast2-installation` (`autoinstallation/src/include/autoinstall/io.rb`) | `Get`/`GetURL` helpers on top of `lib/transfer/file_from_url.rb`; loaded via `Yast.include self, "autoinstall/io.rb"` from `AutoinstConfig.rb` |
| `xslt/merge.xslt` | `autoyast2-installation` (`autoinstallation/xslt/merge.xslt`, third-party LGPL stylesheet by Oliver Becker) | Merges two profile XML documents; invoked by `AutoInstallRules.rb` via `xsltproc`. Installed at `/usr/share/autoinstall/xslt/merge.xslt` by `install.sh`, not loaded as Ruby code |
| `lib/autoinstall/script.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/script.rb`) | `Y2Autoinstallation::Script` and subclasses (`PreScript`, `PostScript`, etc.) |
| `lib/autoinstall/script_runner.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/script_runner.rb`) | Runs `ExecutedScript` instances |
| `lib/autoinstall/xml_checks.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/xml_checks.rb`) | Validates the profile XML against the AutoYaST schema |
| `lib/autoinstall/xml_validator.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/xml_validator.rb`) | Generic RNG validation helper used by `xml_checks.rb` |
| `lib/autoinstall/y2erb.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/y2erb.rb`) | Renders ERB profiles, exposing hardware info to the template |
| `lib/autoinstall/entries/registry.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/entries/registry.rb`) | Used by `Profile#merge_resource_aliases!`; in practice returns no aliases now that the `.desktop` files that used to describe them are no longer installed |
| `lib/autoinstall/entries/description.rb` | `autoyast2-installation` (`autoinstallation/src/lib/autoinstall/entries/description.rb`) | Support class for `registry.rb` |
| `lib/transfer/file_from_url.rb` | `yast2-installation` (`installation/src/lib/transfer/file_from_url.rb`) | Fetches a pre-script when it uses a `location` URL instead of inline `source` text |
| `lib/installation/unmounter.rb` | `yast2-installation` (`installation/src/lib/installation/unmounter.rb`) | Unmounts the target system at the end of the installation |
| `lib/installation/clients/umount_finish.rb` | `yast2-installation` (`installation/src/lib/installation/clients/umount_finish.rb`) | Wraps `Installation::Unmounter` plus some extra target cleanup |
| `lib/installation/cio_ignore.rb` | `yast2-installation` (`installation/src/lib/installation/cio_ignore.rb`) | s390 `cio_ignore`/`rd.zdev` kernel parameter handling. The UI-only `Installation::CIOIgnoreProposal` class was dropped, Agama does not use the interactive AutoYaST/YaST UI |

`Installation::FinishClient` (the common base class for finish steps) and
`Y2Storage::Clients::Finish` / `Y2IscsiClient::FinishClient` (the storage/iSCSI finish
steps) are **not** vendored here: they are provided by the `yast2`, `yast2-storage-ng` and
`yast2-iscsi-client` packages, which remain real runtime dependencies of Agama (see
`spec/0002-drop-yast/plan.md`).
