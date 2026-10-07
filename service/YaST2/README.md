# Vendored YaST/AutoYaST code

This directory contains a **permanent fork** of a small set of Ruby classes originally provided by
the `autoyast2` (`autoyast2-installation`), `yast2-installation`, `yast2-network`, `yast2-s390`,
`yast2-iscsi-client`, `yast2-bootloader`, `yast2-storage-ng` and `yast2-packager` YaST packages.
Agama no longer depends on any of those RPMs; the classes it still needs from them have been
copied here instead.

There is **no process to keep this code in sync with upstream YaST releases**. If a bug is found
here, or a new AutoYaST/DASD/zFCP/iSCSI/bootloader/storage feature is needed, fix/extend the code
directly in this directory; do not expect it to be updated automatically from `yast-autoyast2`,
`yast-installation`, `yast-network`, `yast-s390`, `yast-iscsi-client`, `yast-bootloader`,
`yast-storage-ng` or `yast-packager`.

## Tests

Being the sole maintainer of this code means Agama also owns its test coverage. `service/test/YaST2/`
mirrors this directory's layout and contains tests ported from the original upstream test suites
(`autoyast2-installation`'s, `yast2-installation`'s, `yast2-network`'s, `yast2-s390`'s,
`yast2-iscsi-client`'s, `yast2-bootloader`'s and `yast2-storage-ng`'s `test/` directories), adapted
to run against the vendored copies here instead of an installed RPM. Fixtures they need live under
`service/test/fixtures/yast2/`. As with the production code, there is no process to pull in new
upstream test examples automatically - extend these tests directly when the vendored code changes.

A handful of `y2network` value classes (`startmode.rb`, `startmodes.rb` and its six concrete
subclasses, `wireless_mode.rb`) have no upstream test at all (only interactive-UI widget tests
exist for them) - their tests under `service/test/YaST2/lib/y2network/` were written from scratch
instead of ported.

`y2s390/hwinfo_reader.rb` likewise has no upstream test at all (not even an interactive-UI one) -
its test under `service/test/YaST2/lib/y2s390/hwinfo_reader_test.rb` was written from scratch.

`y2iscsi_client/config.rb` has **no** upstream test coverage of any kind (not even an incidental
reference), and `y2iscsi_client/authentication.rb` has only an incidental one (used as a plain
fixture, `let(:auth) { Y2IscsiClient::Authentication.new }`, inside `IscsiClientLib`'s own
`#discover` tests - never a focused unit test of `Authentication`'s own API). Both
`service/test/YaST2/lib/y2iscsi_client/config_test.rb` and `.../authentication_test.rb` were written
from scratch.

`modules/InstURL.rb` has no upstream test at all -
`service/test/YaST2/modules/InstURL_test.rb` was written from scratch, covering `#installInf2Url`
(the only method actually called anywhere in Agama's closure). `lib/y2packager/repository.rb` and
`zypp_url.rb` do have upstream coverage (`yast2`'s own `test/repository_test.rb`/
`test/y2packager/zypp_url_test.rb`), ported into
`service/test/YaST2/lib/y2packager/{repository,zypp_url}_test.rb`; `repository_test.rb`'s
`#products` describe block (and the `product_factory.rb` helper it alone used) were dropped along
with the production method. `modules/AutoinstFunctions_test.rb`'s `#selected_product` describe
block was likewise dropped along with the trimmed production methods (see "Deliberate deviations
from upstream" below for both).

`yast2-bootloader`'s `exceptions.rb`, `cpu_mitigations.rb` and `stage1_proposal.rb` have no upstream
test at all - `service/test/YaST2/lib/bootloader/{exceptions,cpu_mitigations,stage1_proposal}_test.rb`
were written from scratch. `UnsupportedOption#option` is confirmed broken upstream (identical bug in
current master): `#initialize` assigns the given value to `@reason` instead of `@option`, so the
`attr_reader :option` always returns `nil`. Not fixed here (see "Known limitations" below), just
documented by the corresponding test.

Upstream `yast2-bootloader` tests apply a devicegraph fixture (`trivial.yaml`), `UdevMapping`
stubbing and system-call mocking to literally every example via a top-level `RSpec.configure` block
in its own `test/test_helper.rb`. That global-hook approach isn't appropriate for a shared Agama test
suite (it would affect unrelated specs too), so it's replicated here as an explicit, opt-in
`RSpec.shared_context "yast2-bootloader test setup"` (see
`service/test/YaST2/lib/bootloader/support/shared_setup.rb`), included only by the ported bootloader
specs via `include_context`. It reuses Agama's own `Agama::RSpec::StorageHelpers#mock_storage_probing`
(`service/test/agama/storage/storage_helpers.rb`) under the hood instead of reimplementing devicegraph
loading from scratch.

A handful of `grub2bls`/`systemdboot` write tests and a couple of `language`/`sections` tests read and
write real files under a small fixture tree colocated with the specs themselves
(`service/test/YaST2/lib/bootloader/data/`), mirroring upstream's own `test/data/` layout exactly
(`destdir`/file paths are computed relative to `__dir__` in the original tests, left unchanged) -
unlike every other fixture in this project, these do **not** live under
`service/test/fixtures/yast2/`, specifically to keep that one upstream mechanism working unmodified.

`test/bootloader_base_test.rb` and `test/grub_install_test.rb` were initially missed when the
`yast2-bootloader` test suite was ported, despite both `bootloader_base.rb` and `grub_install.rb`
being vendored and actively used - every other vendored file got 1:1 upstream test coverage except
these two. Caught afterwards by cross-checking the full list of upstream test files against the
vendored production files, and ported into `service/test/YaST2/lib/bootloader/{bootloader_base,
grub_install}_test.rb` unchanged (verbatim content, only the usual `require_relative`/
`include_context "yast2-bootloader test setup"` boilerplate and rubocop line-wrapping applied).
**Lesson for future phases: cross-check the upstream test suite's file list too, not just the
production code's - a 1:1 file-count match is not a byproduct of tracing `require`/`Yast.import`
alone.**

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

Upstream `yast2-storage-ng` tests apply the same kind of global setup (a stubbed
`Y2Packager::Repository`, `Yast::Arch`/`Y2Storage::Arch` mocking driven by a `let(:architecture)`
convention, a default `HWInfoReader` double, the Bcache-unsupported-architecture check disabled by
default, and a `ProductFeatures` reset) via a top-level `RSpec.configure` block in its own
`test/spec_helper.rb`. As with `yast2-bootloader`, this is replicated as an explicit, opt-in
`RSpec.shared_context "yast2-storage-ng test setup"` (see
`service/test/YaST2/lib/y2storage/support/shared_setup.rb`), included only by the ported
`y2storage` specs. Upstream's own `test/support/storage_helpers.rb` (`Yast::RSpec::StorageHelpers`,
the module providing `fake_scenario`/`devicegraph_stub`/`planned_*`/`fstab_entry`/... helpers used
pervasively across the suite) is vendored into
`service/test/YaST2/lib/y2storage/support/storage_helpers.rb` with one deviation (see "Deliberate
deviations from upstream" below): `#devicegraph_stub` no longer touches `Y2Partitioner::DeviceGraphs`,
since `y2partitioner` is never vendored. The handful of other upstream `test/support/*.rb` shared
examples/contexts actually used by the ported specs (`proposal_context`, `proposal_examples`,
`boot_requirements_context`, `candidate_devices_context`, `devices_planner_context`,
`autoinst_profile_sections_examples`, `autoinst_devices_planner_{bcache,btrfs,conflicts}`,
`widgets_context`) are vendored alongside it unchanged. Upstream's `test/data/` fixture tree (device
graphs in YAML/XML, AutoYaST control files, `lszcrypt`/`mkvps`/`zkey` command-output samples) is
copied wholesale into `service/test/fixtures/yast2/y2storage/`, following the project's usual
fixture convention instead of upstream's `test/data/` location (`DATA_PATH` is redefined in
`shared_setup.rb` accordingly; everything else in `storage_helpers.rb` that builds on `DATA_PATH` is
unchanged).

Only the **207 ported production files that have a dedicated 1:1 upstream test file** were ported;
**106 of the 313 vendored `y2storage` files have no upstream test coverage at all** and no new tests
were written for them (see "Known limitations" below for the exact rationale) - most are pure
`require`-only aggregator files (e.g. `planned.rb`, `proposal.rb`, `callbacks.rb`,
`boot_requirements_strategies.rb`, `space_actions.rb`, `filesystems.rb`,
`phys_vol_strategies.rb`/`lvm_space_strategies.rb`/`space_maker_actions.rb`/`space_maker_prospects.rb`),
simple enum-wrapper value classes (`align_policy.rb`, `align_type.rb`, `bcache_type.rb`,
`bootloader_type.rb`, `dasd_type.rb`, `dasd_format.rb`, `data_transport.rb`, `lv_type.rb`,
`partition_type.rb`, `storage_enum_wrapper.rb`), abstract base classes exercised only indirectly
through their concrete subclasses' own tests (`proposal/base.rb`, `partition_tables/base.rb`,
`encryption_method/base.rb`, `encryption_processes/base.rb`, the various `*_strategies/base.rb` and
`space_maker_{actions,prospects}/base.rb` files, `planned/mixins.rb`/`can_be_mounted.rb`/`can_be_pv.rb`),
and a smaller set of genuinely untested upstream logic (e.g. all five concrete
`boot_requirements_strategies/*.rb` backends, the `proposal/lvm_space_strategies/*.rb` and
`proposal/space_maker_{actions,prospects}/*.rb` concrete classes, `proposal/autoinst_drive_planner.rb`,
`callbacks/issues_callback.rb`/`user_probe.rb`). This mirrors upstream's own coverage exactly - it is
not a regression introduced by vendoring.

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
- `Bootloader::UnsupportedOption#option` always returns `nil` instead of the value passed to `.new`
  (`#initialize` assigns it to `@reason` instead of `@option`). Pre-existing upstream bug, confirmed
  identical in current `yast2-bootloader` master; not fixed since nothing in Agama's closure calls
  `#option` (only `#message`, via `Bootloader.rb`'s `Read` rescue clause).
- `rubocop` crashes with `uninitialized constant ...AlignmentCorrector::StringIO` while
  inspecting any file that triggers `Layout/AccessModifierIndentation`'s autocorrector, on this
  sandbox's Ruby 4.0 (`StringIO` is no longer part of the default-loaded standard library there,
  and `rubocop` 1.24.1 - the project's pinned version - doesn't `require "stringio"` itself).
  **This silently swallowed a real offense**: `test/YaST2/lib/y2storage/y2storage/
  match_volume_spec_test.rb`'s misindented `private` only surfaced once run on the project's
  actual CI (Ruby 3.2), where the cop doesn't crash. Workaround for this sandbox:
  `RUBYOPT="-rstringio" bundle exec rubocop ...` - loading `stringio` ahead of time avoids the
  crash entirely, so if `rubocop` appears to crash but otherwise pass (834+ files, 0 offenses) on
  a Ruby 4.0-based sandbox, re-run it with that `RUBYOPT` to get a trustworthy result instead of a
  false negative.

## Deliberate deviations from upstream (not just trims)

A few vendored files were edited beyond the usual "cut UI-only code" trimming already described per
package above - each documented with a "DEVIATION FROM UPSTREAM" comment at the point of the change:

- **`modules/Bootloader.rb`**: the `Export`/`Import` public methods and the private
  `import_bootloader` helper were removed, along with the `bootloader/autoyast_converter` and
  `bootloader/autoinst_profile/bootloader_section` requires they alone needed (~700 lines across 5
  files that exist solely to support the interactive AutoYaST bootloader-import workflow). Agama
  never calls `Export`/`Import`: its own AutoYaST bootloader-section reader
  (`service/lib/agama/autoyast/bootloader_reader.rb`) reads the raw profile hash directly and never
  touches this module. None of the methods Agama *does* need (`kernel_param`, `modify_kernel_params`,
  `ReadOrProposeIfNeeded`, `Read`, `Write`, `Propose`, `Reset`, ...) call into the removed code.
- **`lib/bootloader/finish_client.rb`**: `#set_boot_msg` upstream dynamically dispatches to a
  `"reipl_bootloader_finish"` YaST client (shipped by the separate `yast2-reipl` package, not
  vendored) via `Yast::WFM.call` on s390, to run `chreipl node /boot/zipl` (setting the re-IPL device
  for the next boot) and optionally customize the shutdown message. That client always returned
  `"different" => false` in practice, making the message-customization branch dead code even
  upstream. The `chreipl` call is now inlined directly
  (`Yast::Execute.on_target("chreipl", "node", "/boot/zipl") if Yast::Arch.s390`) and the dead
  branching was removed. This is what finally allows dropping the `yast2-reipl` RPM `Requires:` -
  see `service/package/gem2rpm.yml`.
- **`test/YaST2/lib/bootloader/sections_test.rb`** (test-only): `#handles localized grub.cfg` now
  reads its fixture with an explicit `encoding: "UTF-8"` instead of upstream's plain `File.read`.
  Ruby's `Encoding.default_external` is fixed at interpreter startup from the actual shell locale;
  `test_helper.rb`'s `ENV["LC_ALL"] = "en_US.UTF-8"` runs *after* that and has no effect on it. On
  a CI container that starts Ruby without a UTF-8 locale already set, this genuinely-UTF-8 fixture
  (it contains Cyrillic text) would be misread as US-ASCII, raising `ArgumentError: invalid byte
  sequence in US-ASCII` down the line in `CFA::Grub2::GrubCfg#load`. Reproduced exactly with
  `LC_ALL=C LANG=C bundle exec rspec ...` locally; confirmed fixed with the explicit encoding.
- **`test/YaST2/lib/y2storage/support/storage_helpers.rb`** (test-only):
  - Dropped the `require "y2partitioner/device_graphs"` and the
    `Y2Partitioner::DeviceGraphs.create_instance` call inside `#devicegraph_stub`. `y2partitioner`
    is never vendored (confirmed unused by Agama - see below). The specs that call
    `#devicegraph_stub` itself (`encryption_method_test.rb`) don't need that partitioner-specific
    cache; the three specs that referenced `Y2Partitioner::DeviceGraphs.instance.current` directly
    in their own setup (`encryption_processes/{luks,pervasive,systemd_fde}_test.rb`'s
    `let(:devicegraph)`) were updated to use `Y2Storage::StorageManager.instance.staging` instead -
    the same devicegraph, without going through the unvendored partitioner cache.
  - Added a `#dup_strings` helper, used by `#fstab_entry`/`#crypttab_entry` to `.dup` any `String`
    argument (including one level deep inside an `Array`) before building the mocked
    `Storage::SimpleEtcFstabEntry`/`SimpleEtcCrypttabEntry`. Every test file in this project has
    `# frozen_string_literal: true`, so string literals passed as fixture values here are frozen by
    default; some production code (e.g. `StorageClassWrapper.object_for`) calls `#force_encoding`
    on them (an in-place mutation), which raises `FrozenError` unless the test hands over a mutable
    copy instead of the frozen literal.
- **Frozen-string-literal/mutation fixes** (test-only, same root cause as the `#dup_strings` helper
  above - several vendored `Y2Storage` classes call `#force_encoding` on strings handed to them,
  which fails with `FrozenError` against this project's `# frozen_string_literal: true` test
  files): `secret_attributes_test.rb` and `callbacks/{activate,check,commit,probe}_test.rb` /
  `callbacks/issues_callback_examples.rb` use the unary `+"..."` idiom (or wrap a heredoc as
  `+<<~...`) to pass a mutable copy of each literal string into the mocked/real call, instead of
  upstream's plain literals.
- **`test/YaST2/lib/y2storage/y2storage/planned/can_be_encrypted_test.rb`** (test-only): `plain_device`
  uses a plain `double` instead of `instance_double`. `rspec-mocks` 3.11.x (pinned project-wide) has
  a real bug, reproducible on both this sandbox and the project's actual CI (both run Ruby 4.0): a
  *verifying* double's `#with(hash)` argument matcher reports "unexpected arguments" even when the
  actual and expected hash values are the exact same object, whenever the mocked method
  (`Y2Storage::BlkDevice#encrypt`) has a `**rest`-style keyword parameter. Confirmed unrelated to
  `EncryptionMethod`'s own `#==`/`#eql?` (reproduces identically with plain `String` values too). A
  plain (non-verifying) `double` isn't subject to the code path that triggers the bug.
- **`modules/InstURL.rb`**: dropped the unused `Yast.import "CheckMedia"` call from `#main`. Nothing
  in `#installInf2Url` (the only method actually called anywhere in Agama's closure) or any other
  method defined in the class references `CheckMedia`, and vendoring that separate module (which has
  its own further dependencies) just to satisfy an unused import would be unnecessary bloat.
- **`lib/y2packager/repository.rb`**: dropped `#products`/`#addons`, along with the
  `require "y2packager/product"`/`require "y2packager/resolvable"` they alone needed.
  `Y2Storage::DiskAnalyzer` - the only caller anywhere in Agama's closure - only ever calls
  `.all`/`#local?`/`#url`. `#products`/`#addons` pull in `Y2Packager::Product`, which transitively
  needs the yast2-packager-only `Yast::InstURL` chain (via its license-fetching mixin) - avoided
  entirely by cutting the two methods nothing calls.
- **`modules/AutoinstFunctions.rb`** (from an earlier phase): dropped `#selected_product`,
  `#available_base_products`, `#reset_product`, the `PRODUCT_MAPPING` constant, and the private
  `#identify_product`/`#identify_product_by_*`/`#base_product_name` helpers they alone needed,
  along with the `require "y2packager/product"`/`"y2packager/product_reader"`/
  `"y2packager/product_spec"`/`"y2packager/medium_type"` lines. This is AutoYaST's own
  base-product auto-detection logic (matching patterns/packages/an explicit product name from the
  profile against products available on the install media) - confirmed unused anywhere in Agama's
  closure (only `#second_stage_required?`/`#check_second_stage_environment` are ever called, via
  `Profile.rb`). Agama has its own, independent AutoYaST product detection
  (`service/lib/agama/autoyast/product_reader.rb`), which reads the raw profile hash directly
  instead. `y2packager/product_spec.rb`/`medium_type.rb` are genuinely `yast2-packager`-only
  (confirmed via `rpm -qf`), and `yast2-packager` can never be a runtime dependency of Agama at
  all - see "`yast2-packager`: a circular RPM dependency" below.

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
- `scrconf/` - SCR agent registration files (`.scr`), the non-Ruby counterpart of `modules/`/
  `include/`. Like them, resolved through `Y2DIR`: YaST's SCR implementation scans a `scrconf/`
  subdirectory of every `Y2DIR` entry for agent definitions. `iscsid.scr` registers the
  `.etc.iscsid`/`.etc.iscsid.all` path `Y2IscsiClient::Config` reads/writes `/etc/iscsi/iscsid.conf`
  through; `cfg_bootloader.scr` registers `.sysconfig.bootloader`, read/written by
  `Bootloader::Sysconfig` (and transitively by `BootloaderFactory.current`, called constantly);
  `sysconfig_storage.scr` registers `.sysconfig.storage`, read/written by `Y2Storage::SysconfigStorage`
  (used by `StorageManager`); `sysconfig_fde-tools.scr` registers `.sysconfig.fde-tools`, read/written
  by `Y2Storage::EncryptionProcesses::FdeToolsConfig` (used by the TPM-FDE encryption method).
  All four are generic `ag_ini` agents, not package-specific code - but the `.scr` registration file
  itself is only shipped by the corresponding package. **This kind of non-Ruby, SCR-level asset is
  easy to miss when auditing a package's `require`/`Yast.import` graph** - the `iscsid.scr` one was
  initially missed, surfacing as a silent `nil` from `Yast::SCR.Read` once `yast2-iscsi-client` was
  fully uninstalled (not just made a non-declared dependency). Check for `src/scrconf/*.scr` files
  in the upstream package whenever vendoring a new one. (`yast2-storage-ng` ships a third `.scr` file,
  `etc_mtab.scr` - upstream itself flags it as dead code in a `FIXME: Remove this SCR agent...`
  comment, and nothing in `y2storage`'s own closure references it; it was not vendored.)

### Lesson from the yast2-bootloader phase: classic modules can hide in surprising places

While vendoring `yast2-bootloader`, `Yast::BootArch` (`modules/BootArch.rb`) was initially missed
entirely: it's a real, load-bearing dependency (`Yast::BootArch.DefaultKernelParams` is called by
`grub2base.rb`, `grub2bls.rb` and `systemdboot.rb`) that one might reasonably assume lives in the
base `yast2` package - after all, `BootStorage`/`Bootloader` are *also* classic
`Yast.import`-based modules bundled inside `yast2-bootloader` rather than a separate package, so
there's no a priori reason to expect any particular classic module name to live in any particular
package. It was caught by cross-checking `rpm -ql yast2-bootloader`'s full file list against the
`require`/`Yast.import` graph used to derive the vendoring closure, **after** the closure had
already been vendored and tested - not before. **For future phases, run that `rpm -ql`
cross-check as a verification step before considering a package's vendoring done**, not only the
forward `require`/`Yast.import` trace from Agama's own entry points - the forward trace is
necessarily incomplete if even one transitive `Yast.import` target is missed along the way (in this
case, nothing upstream *tells* you which package a classic module lives in; you have to check).

## Vendored classes

| File                                                                                                                                                                                       | Originally from                                                                                             | Notes                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/AutoinstConfig.rb`                                                                                                                                                                | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstConfig.rb`)                                 | AutoYaST global configuration (profile URL, temp dirs, etc.)                                                                                                                                                                                                                                                    |
| `modules/AutoinstScripts.rb`                                                                                                                                                               | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstScripts.rb`)                                | Collects and runs `<scripts>`                                                                                                                                                                                                                                                                                   |
| `modules/Profile.rb`                                                                                                                                                                       | `autoyast2-installation` (`autoinstallation/src/modules/Profile.rb`)                                        | `Yast::Profile` and `Yast::ProfileHash`, the in-memory profile representation                                                                                                                                                                                                                                   |
| `modules/ProfileLocation.rb`                                                                                                                                                               | `autoyast2-installation` (`autoinstallation/src/modules/ProfileLocation.rb`)                                | Fetches the profile from its configured location (URL, rules/classes, etc.)                                                                                                                                                                                                                                     |
| `modules/AutoInstallRules.rb`                                                                                                                                                              | `autoyast2-installation` (`autoinstallation/src/modules/AutoInstallRules.rb`)                               | `<rules>`/`<classes>` matching engine. Requires `xslt/merge.xslt` (see below)                                                                                                                                                                                                                                   |
| `modules/AutoinstFunctions.rb`                                                                                                                                                             | `autoyast2-installation` (`autoinstallation/src/modules/AutoinstFunctions.rb`)                              | `#second_stage_required?`/`#check_second_stage_environment`, used by `Profile.rb` to decide whether a second installation stage needs to run. The base-product auto-detection methods were trimmed - see "Deliberate deviations from upstream" below                                                            |
| `modules/ServicesManagerTarget.rb`                                                                                                                                                         | `yast2-services-manager` (`services-manager/src/modules/services_manager_target.rb`)                        | Only `ServicesManagerTargetClass::BaseTargets` (a target-name/translation lookup table) is used, by `AutoinstConfig`; the rest of the class (reading/writing the systemd default target) is unused dead code, kept only because `Yast.import "ServicesManagerTarget"` needs the whole file to load successfully |
| `modules/InstURL.rb`                                                                                                                                                                       | `yast2-packager` (`library/packages/src/modules/InstURL.rb`)                                                | `Yast::InstURL`, converts `/etc/install.inf` data to a repository URL. Needed by `AutoinstFunctions.rb#main`, `lib/transfer/file_from_url.rb` and `modules/ProfileLocation.rb`. Only `#installInf2Url` is ever called - see "Deliberate deviations from upstream" below                                          |
| `lib/y2packager/repository.rb`                                                                                                                                                             | currently base `yast2` (`library/packages/src/lib/y2packager/repository.rb`); historically `yast2-packager` | `Y2Packager::Repository`, used by `Y2Storage::DiskAnalyzer#candidate_devices` to exclude the disk backing the installation repository from the candidate list. `#products`/`#addons` were trimmed - see "Deliberate deviations from upstream" below                                                              |
| `lib/y2packager/zypp_url.rb`                                                                                                                                                               | currently base `yast2` (`library/packages/src/lib/y2packager/zypp_url.rb`); historically `yast2-packager`   | `Y2Packager::ZyppUrl`, a `URI` wrapper used by `Repository#local?`/`#url`                                                                                                                                                                                                                                         |
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
| `modules/IscsiClientLib.rb`                                                                                                                                                                | `yast2-iscsi-client` (`src/modules/IscsiClientLib.rb`)                                                      | `Yast::IscsiClientLib`, the main iSCSI discovery/login/session-management module (wraps `iscsiadm`/`iscsiuio`)                                                                                                                                                                                                    |
| `lib/y2iscsi_client/authentication.rb`                                                                                                                                                     | `yast2-iscsi-client` (`src/lib/y2iscsi_client/authentication.rb`)                                           | `Y2IscsiClient::Authentication`, CHAP discovery/login authentication data                                                                                                                                                                                                                                         |
| `lib/y2iscsi_client/config.rb`                                                                                                                                                             | `yast2-iscsi-client` (`src/lib/y2iscsi_client/config.rb`)                                                   | `Y2IscsiClient::Config`, reads/writes `/etc/iscsi/iscsid.conf`; only used transitively, via `IscsiClientLib`'s own internal `require`                                                                                                                                                                             |
| `lib/y2iscsi_client/timeout_process.rb`                                                                                                                                                    | `yast2-iscsi-client` (`src/lib/y2iscsi_client/timeout_process.rb`)                                          | `Y2IscsiClient::TimeoutProcess`, runs a command under `timeout(1)`; only used transitively, via `IscsiClientLib`'s own internal `require`                                                                                                                                                                         |
| `lib/y2iscsi_client/finish_client.rb`                                                                                                                                                      | `yast2-iscsi-client` (`src/lib/y2iscsi_client/finish_client.rb`)                                            | `Y2IscsiClient::FinishClient`, copies the iSCSI configuration to the target system and enables the needed services/sockets at the end of installation                                                                                                                                                            |
| `scrconf/iscsid.scr`                                                                                                                                                                       | `yast2-iscsi-client` (`src/scrconf/iscsid.scr`)                                                             | Registers the `.etc.iscsid`/`.etc.iscsid.all` SCR path that `Y2IscsiClient::Config` reads/writes `/etc/iscsi/iscsid.conf` through (generic `ag_ini` agent config, not Ruby code)                                                                                                                                 |
| `modules/Bootloader.rb`                                                                                                                                                                    | `yast2-bootloader` (`src/modules/Bootloader.rb`)                                                            | `Yast::Bootloader` facade (`kernel_param`/`modify_kernel_params`/`Read`/`Write`/`Propose`/...). See "Deliberate deviations from upstream" below: `Export`/`Import` removed                                                                                                                                       |
| `modules/BootStorage.rb`                                                                                                                                                                   | `yast2-bootloader` (`src/modules/BootStorage.rb`)                                                           | `Yast::BootStorage`, storage-query layer (boot/root filesystem, disks, swap, encryption...) used by every grub2-family backend                                                                                                                                                                                   |
| `modules/BootArch.rb`                                                                                                                                                                      | `yast2-bootloader` (`src/modules/BootArch.rb`)                                                              | `Yast::BootArch`, computes the default kernel command line (`DefaultKernelParams`) per architecture; used by `grub2base.rb`/`grub2bls.rb`/`systemdboot.rb`. Initially missed when auditing the `require`/`Yast.import` graph - see note below                                                                   |
| `lib/bootloader/exceptions.rb`                                                                                                                                                             | `yast2-bootloader` (`src/lib/bootloader/exceptions.rb`)                                                     | `Bootloader::{UnsupportedBootloader,BrokenConfiguration,BrokenByPathDeviceName,UnsupportedOption,InvalidSerialConsoleArguments,NoRoot}`                                                                                                                                                                           |
| `lib/bootloader/sysconfig.rb`                                                                                                                                                              | `yast2-bootloader` (`src/lib/bootloader/sysconfig.rb`)                                                      | `Bootloader::Sysconfig`, reads/writes `/etc/sysconfig/bootloader` via the vendored `scrconf/cfg_bootloader.scr` agent                                                                                                                                                                                             |
| `lib/bootloader/udev_mapping.rb`                                                                                                                                                           | `yast2-bootloader` (`src/lib/bootloader/udev_mapping.rb`)                                                   | `Bootloader::UdevMapping`, maps device names to/from their udev by-* names                                                                                                                                                                                                                                        |
| `lib/bootloader/device_path.rb`                                                                                                                                                            | `yast2-bootloader` (`src/lib/bootloader/device_path.rb`)                                                    | Small device-path helper used by `UdevMapping`                                                                                                                                                                                                                                                                    |
| `lib/bootloader/bootloader_base.rb`                                                                                                                                                        | `yast2-bootloader` (`src/lib/bootloader/bootloader_base.rb`)                                                | `Bootloader::BootloaderBase`, common base class for all concrete backends                                                                                                                                                                                                                                         |
| `lib/bootloader/none_bootloader.rb`                                                                                                                                                        | `yast2-bootloader` (`src/lib/bootloader/none_bootloader.rb`)                                                | `Bootloader::NoneBootloader`, the "do not manage any bootloader" backend                                                                                                                                                                                                                                          |
| `lib/bootloader/cpu_mitigations.rb`                                                                                                                                                        | `yast2-bootloader` (`src/lib/bootloader/cpu_mitigations.rb`)                                                | `Bootloader::CpuMitigations`, the `mitigations=` kernel parameter value object                                                                                                                                                                                                                                    |
| `lib/bootloader/bls.rb`, `bls_sections.rb`                                                                                                                                                 | `yast2-bootloader`                                                                                           | `Bootloader::Bls`, sd-boot/BLS (Boot Loader Specification) menu entry handling shared by `Grub2Bls` and `SystemdBoot`                                                                                                                                                                                             |
| `lib/bootloader/serial_console.rb`                                                                                                                                                         | `yast2-bootloader` (`src/lib/bootloader/serial_console.rb`)                                                 | Parses/builds the GRUB serial console kernel parameter                                                                                                                                                                                                                                                            |
| `lib/bootloader/language.rb`                                                                                                                                                               | `yast2-bootloader` (`src/lib/bootloader/language.rb`)                                                       | Reads the GRUB menu language from `grub.cfg`                                                                                                                                                                                                                                                                      |
| `lib/bootloader/os_prober.rb`                                                                                                                                                              | `yast2-bootloader` (`src/lib/bootloader/os_prober.rb`)                                                      | Enables/disables GRUB's `os-prober` integration                                                                                                                                                                                                                                                                   |
| `lib/bootloader/sections.rb`                                                                                                                                                               | `yast2-bootloader` (`src/lib/bootloader/sections.rb`)                                                       | Reads/writes the default boot menu entry from `grub.cfg`                                                                                                                                                                                                                                                          |
| `lib/bootloader/grub2pwd.rb`                                                                                                                                                               | `yast2-bootloader` (`src/lib/bootloader/grub2pwd.rb`)                                                       | GRUB password protection (`set_authentication`)                                                                                                                                                                                                                                                                   |
| `lib/bootloader/boot_record_backup.rb`                                                                                                                                                     | `yast2-bootloader` (`src/lib/bootloader/boot_record_backup.rb`)                                             | Backs up/restores the MBR/boot record before/after writing it                                                                                                                                                                                                                                                     |
| `lib/bootloader/grub2base.rb`                                                                                                                                                              | `yast2-bootloader` (`src/lib/bootloader/grub2base.rb`)                                                      | `Bootloader::Grub2Base`, shared base for all grub2-family backends (config merging via CFA, serial console, os-prober, GRUB password); the single largest file in this closure                                                                                                                                  |
| `lib/bootloader/grub_install.rb`                                                                                                                                                           | `yast2-bootloader` (`src/lib/bootloader/grub_install.rb`)                                                   | Runs `grub2-install`                                                                                                                                                                                                                                                                                              |
| `lib/bootloader/pmbr.rb`                                                                                                                                                                   | `yast2-bootloader` (`src/lib/bootloader/pmbr.rb`)                                                           | Sets the protective-MBR flag on GPT disks via `parted`                                                                                                                                                                                                                                                            |
| `lib/bootloader/mbr_update.rb`                                                                                                                                                             | `yast2-bootloader` (`src/lib/bootloader/mbr_update.rb`)                                                     | Updates the MBR code on the relevant disks                                                                                                                                                                                                                                                                        |
| `lib/bootloader/device_map.rb`                                                                                                                                                             | `yast2-bootloader` (`src/lib/bootloader/device_map.rb`)                                                     | BIOS device-map proposal/handling (`device.map` file)                                                                                                                                                                                                                                                             |
| `lib/bootloader/stage1_proposal.rb`                                                                                                                                                        | `yast2-bootloader` (`src/lib/bootloader/stage1_proposal.rb`)                                                | Architecture-specific stage1 (boot device) proposal logic (x86_64/i386, s390, ppc64)                                                                                                                                                                                                                              |
| `lib/bootloader/stage1.rb`                                                                                                                                                                 | `yast2-bootloader` (`src/lib/bootloader/stage1.rb`)                                                         | `Bootloader::Stage1`, the stage1 (boot device) configuration model used by the grub2 backends                                                                                                                                                                                                                     |
| `lib/bootloader/systeminfo.rb`                                                                                                                                                             | `yast2-bootloader` (`src/lib/bootloader/systeminfo.rb`)                                                     | Hardware/firmware queries (EFI, secure boot, NVRAM support...) shared by several backends                                                                                                                                                                                                                         |
| `lib/bootloader/grub2.rb`                                                                                                                                                                  | `yast2-bootloader` (`src/lib/bootloader/grub2.rb`)                                                          | `Bootloader::Grub2`, the legacy BIOS/CSM GRUB2 backend                                                                                                                                                                                                                                                             |
| `lib/bootloader/grub2efi.rb`                                                                                                                                                               | `yast2-bootloader` (`src/lib/bootloader/grub2efi.rb`)                                                       | `Bootloader::Grub2EFI`, the UEFI GRUB2 backend                                                                                                                                                                                                                                                                     |
| `lib/bootloader/grub2bls.rb`                                                                                                                                                               | `yast2-bootloader` (`src/lib/bootloader/grub2bls.rb`)                                                       | `Bootloader::Grub2Bls`, the UEFI GRUB2 + BLS (Boot Loader Specification) backend                                                                                                                                                                                                                                  |
| `lib/bootloader/systemdboot.rb`                                                                                                                                                            | `yast2-bootloader` (`src/lib/bootloader/systemdboot.rb`)                                                    | `Bootloader::SystemdBoot`, the systemd-boot backend                                                                                                                                                                                                                                                               |
| `lib/bootloader/bootloader_factory.rb`                                                                                                                                                     | `yast2-bootloader` (`src/lib/bootloader/bootloader_factory.rb`)                                             | `Bootloader::BootloaderFactory`, instantiates/caches the right backend by name and exposes `.current`/`.system`/`.proposed`                                                                                                                                                                                       |
| `lib/bootloader/kexec.rb`                                                                                                                                                                  | `yast2-bootloader` (`src/lib/bootloader/kexec.rb`)                                                          | `Bootloader::Kexec`, prepares the kexec environment to skip a reboot between installation stages                                                                                                                                                                                                                 |
| `lib/bootloader/finish_client.rb`                                                                                                                                                          | `yast2-bootloader` (`src/lib/bootloader/finish_client.rb`)                                                  | `Bootloader::FinishClient`, writes the final bootloader configuration to the target system. See "Deliberate deviations from upstream" below: the s390 reIPL dispatch was inlined                                                                                                                                 |
| `scrconf/cfg_bootloader.scr`                                                                                                                                                               | `yast2-bootloader` (`src/scrconf/cfg_bootloader.scr`)                                                       | Registers the `.sysconfig.bootloader` SCR path that `Bootloader::Sysconfig` (and transitively `BootloaderFactory.system`, called by `BootloaderFactory.current`) reads/writes through (generic `ag_ini` agent config, not Ruby code)                                                                            |

### yast2-storage-ng (313 files - summarized by directory, not per-file)

Unlike every other package above, `yast2-storage-ng`'s closure is too large (313 production files,
~54K lines) to usefully document one row per file. It's summarized here by directory instead; see
`service/YaST2/lib/y2storage/` itself (it mirrors upstream's `src/lib/y2storage/` layout exactly) for
the full file list.

| Directory                             | Files | Purpose                                                                                                                                                                                      |
| -------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `y2storage/` (top level)              |   123 | The devicegraph object model (`Devicegraph`, `Device`, `BlkDevice`, `Disk`, `Partition`, `LvmVg`/`Pv`/`Lv`, `Md*`, `Bcache*`, `Luks`, `Encryption`, `MountPoint`, `Btrfs*`...), `StorageManager`, `DiskAnalyzer`, `BootRequirementsChecker`, `SetupChecker`, `DumpManager`, `ProposalSettings`, `Configuration`, `Fstab`/`Crypttab`, `YamlWriter`, `Issue`/`IssuesReporter`, and the `y2storage.rb` umbrella itself |
| `y2storage/proposal/`                 |    45 | The guided storage proposal engine: `GuidedProposal`, `SpaceMaker`, `DevicesPlanner`, `DevicesCreator`, creators/planners for each device type, `PartitionsDistributionCalculator`           |
| `y2storage/planned/`                  |    24 | `Planned::*` value objects (the proposal's "what to create" intermediate representation, before actual libstorage-ng devices exist)                                                          |
| `y2storage/autoinst_issues/`          |    22 | `AutoinstIssues::*`, structured warnings/errors collected while building an AutoYaST storage proposal                                                                                         |
| `y2storage/encryption_processes/`     |    12 | `EncryptionProcesses::*`, the actual encrypt/open/commit mechanics per method (LUKS1/2, TPM-FDE, pervasive/secure-key, systemd-FDE...)                                                        |
| `y2storage/encryption_method/`        |    11 | `EncryptionMethod::*`, the user-facing encryption method catalog (delegates the mechanics to `encryption_processes/`)                                                                         |
| `y2storage/boot_requirements_strategies/` |    10 | Per-architecture/bootloader boot partition requirement rules, used by `BootRequirementsChecker`                                                                                          |
| `y2storage/filesystems/`              |    10 | `Filesystems::*` (Btrfs/Ext*/XFS/swap/NFS/Tmpfs... types and the shared `BlkFilesystem`/`Base` classes)                                                                                       |
| `y2storage/autoinst_profile/`         |     9 | `AutoinstProfile::*Section`, the typed `<partitioning>` AutoYaST profile schema (read **and** written by `AutoinstProposal`, the written side also used by Agama's own storage-to-profile export) |
| `y2storage/callbacks/`                |     8 | `Callbacks::*`, libstorage-ng's probe/commit callback interface (`Callbacks::Probe` calls `Yast::Pkg` - see below)                                                                            |
| `y2storage/partition_tables/`         |     7 | `PartitionTables::*` (MSDOS/GPT/DASD partition table flavors)                                                                                                                                 |
| `y2storage/proposal/space_maker_actions/` |     7 | Strategies `SpaceMaker` uses to free up space (delete/shrink/wipe), selected via `proposal/space_maker_prospects/`                                                                       |
| `y2storage/proposal/space_maker_prospects/` |   6 | Candidate actions (delete/resize/wipe a given partition or disk) that `space_maker_actions/` chooses from                                                                               |
| `y2storage/inhibitors/`               |     3 | `Inhibitors::*`, stops `mdadm`/systemd-udev/udisks2 from auto-assembling RAIDs/mounting devices while Agama is probing/installing (used directly by `Agama::DBus::Storage::Manager`)         |
| `y2storage/proposal/lvm_space_strategies/` |   3 | How `SpaceMaker` frees space specifically within an existing LVM volume group                                                                                                            |
| `y2storage/proposal/phys_vol_strategies/` |   3 | How the proposal decides which disks become LVM physical volumes                                                                                                                           |
| `y2storage/space_actions/`            |     3 | `SpaceActions::*`, the planned-vs-executed action pair (`Delete`/`Resize`) used while building an action summary                                                                              |
| `y2storage/clients/`                  |     2 | `Clients::Finish` (called by `Agama::Storage::Finisher`) and `Clients::InstPrepdisk` (called by `Agama::Storage::Manager#install`) - the only two files **not** reached by `require "y2storage"`, loaded on demand instead |
| `y2storage/dialogs/` + `dialogs/callbacks/` |   3 | `Dialogs::Issues`/`IssuesDetails` (non-interactive-safe: just build a `CWM`-free summary used by `IssuesReporter`) and `Dialogs::Callbacks::ActivateLuks` (the default libstorage-ng LUKS-activation callback) - **not** the full interactive `Dialogs::GuidedSetup::*`/`Dialogs::Proposal` wizard tree, which is never reached |
| `y2storage/refinements/`              |     1 | `Refinements::SizeCasts` (`42.GiB` style numeric literals), used pervasively in both production code and specs                                                                                |
| `y2storage/widgets/`                  |     1 | `Widgets::Issues`, a `CWM::CustomWidget` used by `Dialogs::IssuesDetails` above (built but never necessarily shown on an actual screen in Agama's non-interactive flow)                       |

Plus 9 files reached only through a **direct, narrow `require`** from Agama's own code or from one
of the files above - never pulled in by the `require "y2storage"` umbrella itself, and easy to miss
by only tracing that umbrella's own `require` graph: `y2storage/inhibitors.rb` + its 3
`inhibitors/*.rb` files (`Agama::DBus::Storage::Manager` calls `Y2Storage::Inhibitors.new.inhibit`
directly), `y2storage/device_description.rb` and `y2storage/filesystem_label.rb` (both called
directly from `service/lib/agama/storage/devicegraph_conversions/to_json_conversions/`),
`y2storage/used_filesystems.rb` (needed transitively by `clients/finish.rb`, which itself `require`s
it explicitly rather than depending on the umbrella), and `y2storage/clients/{finish,inst_prepdisk}.rb`
themselves.

`scrconf/sysconfig_storage.scr` and `scrconf/sysconfig_fde-tools.scr` are vendored into
`service/YaST2/scrconf/`, registering `.sysconfig.storage` (read/written by
`Y2Storage::SysconfigStorage`, used by `StorageManager`) and `.sysconfig.fde-tools` (read/written by
`Y2Storage::EncryptionProcesses::FdeToolsConfig`, used by the TPM-FDE encryption method)
respectively. A third one, `scrconf/etc_mtab.scr`, is upstream-flagged dead code (a `FIXME: Remove
this SCR agent...` comment) with zero references anywhere in the closure - not vendored.

**Not vendored, kept as real native (non-Ruby) runtime dependencies**: `require "storage"` loads
`libstorage-ng-ruby`'s compiled SWIG extension (the actual libstorage-ng C++ library bindings -
there is no Ruby source to vendor), and `Y2Storage::Callbacks::Probe` unconditionally calls
`Yast::Pkg.SourceReleaseAll`/`Yast::Pkg.SourceStartCache` (from `yast2-pkg-bindings`, also a native
SWIG extension) on every `StorageManager#probe`. Both were previously only *transitive*
dependencies (pulled in by `yast2-storage-ng`'s own RPM spec); now that the RPM itself is dropped,
both are declared as explicit `Requires:` in `service/package/gem2rpm.yml` instead.

### `yast2-packager`: a circular RPM dependency, and why it's never declared

`yast2-storage-ng.spec` also declares `Requires: yast2-packager >= 3.3.7` (needed by
`Y2Storage::DiskAnalyzer#candidate_devices`'s `Y2Packager::Repository.all` call). The obvious fix -
declare `Requires: yast2-packager` explicitly, same as the two native bindings above - **does not
work**: `yast2-packager.spec` itself declares `Requires: yast2-storage-ng >= 4.0.141`. The two
packages have a genuine circular `Requires:` on each other (confirmed via both `.spec` files and
`rpm -q --requires` on a live system), so declaring `yast2-packager` would silently pull
`yast2-storage-ng` straight back in via zypper's dependency resolution - defeating the entire point
of this phase. **Lesson for future phases: before declaring a `Requires:` to replace a transitive
dependency, check the replacement's *own* spec file for a reverse dependency back onto the package
being dropped.**

Investigating further (tracing the real file-ownership with `rpm -qf`, and the real call graphs)
found that almost none of what Agama's closure actually touches is `yast2-packager`-specific
Ruby code after all - most of the `y2packager/` namespace has moved into the base `yast2` package
over time, confirmed via `rpm -qf` turning up `yast2`, not `yast2-packager`, for `repository.rb`,
`product.rb`, `resolvable.rb`, `license.rb` and the rest of the license-fetching chain. Only two
things are genuinely `yast2-packager`-only:

- `modules/InstURL.rb` (`Yast::InstURL`) - needed directly by `AutoinstFunctions.rb`'s `#main`
  (always `Yast.import`ed) and by the already-vendored `lib/transfer/file_from_url.rb`/
  `modules/ProfileLocation.rb`. Vendored here with the same unused-`CheckMedia`-import trim as
  before (see "Deliberate deviations from upstream" below).
- `y2packager/product_spec.rb`/`medium_type.rb` - needed only by `AutoinstFunctions.rb`'s
  `#selected_product`/`#available_base_products` base-product auto-detection logic, which turned
  out to be **confirmed dead code from Agama's perspective** (see below) - so these were never
  vendored at all, the methods that needed them were removed instead.

`lib/y2packager/repository.rb` (`Y2Packager::Repository`) and `zypp_url.rb` (`Y2Packager::ZyppUrl`)
*are* vendored here too, even though they currently happen to live in base `yast2` already -
relying on exactly where a given class is packaged upstream, across YaST releases, is fragile, and
this is a permanent fork anyway. `#products`/`#addons` (and the `Y2Packager::Product`/`Resolvable`
chain they alone needed, which is what pulls in the license-fetching/`InstURL` machinery) were
trimmed, since `DiskAnalyzer` only ever calls `.all`/`#local?`/`#url` - see "Deliberate deviations
from upstream" below.

`yast2-packager.spec` also declares `Requires: yast2-transfer` (no circular dependency there -
`yast2-transfer` doesn't require either package back). The already-vendored
`lib/transfer/file_from_url.rb` unconditionally does `Yast.import "FTP"`/`"HTTP"`/`"TFTP"`, all
three genuinely `yast2-transfer`-only (confirmed via `rpm -qf`) - this one wasn't worth vendoring
(FTP/TFTP clients are a lot more than the "one unused import" situations above), so
`Requires: yast2-transfer` is declared explicitly instead, same as the two native bindings.

All three of these gaps (`InstURL`, the trimmed `AutoinstFunctions.rb` methods, and
`yast2-transfer`) existed from the moment the AutoYaST code was first vendored in an earlier phase,
silently masked by `yast2-storage-ng` happening to also be installed (and therefore pulling in
`yast2-packager`, which pulls in `yast2-transfer`, transitively) this whole time - only surfacing
once `yast2-storage-ng` was actually uninstalled as part of validating *this* phase.
`yast2-transfer` specifically was only caught via **the project's actual CI** (a fresh container
built strictly from `gem2rpm.yml`'s `Requires:` list) rather than local testing, since the
sandbox used for this phase's development happened to still have `yast2-transfer` installed as a
leftover from unrelated packages even after `yast2-storage-ng`/`yast2-packager` were removed.
**Lessons for future phases:**
- **Always re-run the *whole* test suite, not just the newly-vendored package's own tests, against
  the real-uninstalled system** - a dependency gap in a previously-vendored, seemingly unrelated
  package can be masked by the very RPM a later phase removes, and the only way to catch it is
  exercising code paths outside the new phase's own scope too.
- **A local "real-uninstall" test can still miss gaps that only show up in a truly clean
  environment** (no incidentally-still-installed packages left over from something else) - check
  the actual CI run (a fresh container) too, not just a local `zypper remove`, before considering
  the dependency cleanup complete.
- When dropping a transitive dependency, it's worth cross-checking *every* `Requires:` in the
  dropped package's own `.spec` file against what Agama's closure actually needs, not just the one
  or two that happen to crash first - `yast2-packager.spec` alone accounted for three separate,
  unrelated gaps here (`yast2-pkg-bindings` from the original `yast2-storage-ng` phase work,
  `InstURL`, and `yast2-transfer`).

`y2partitioner` (the interactive partitioner UI, a separate top-level package from `y2storage`
despite living in the same source repository) is **not vendored at all**: confirmed zero references
to any `Y2Partitioner::*` constant anywhere in Agama's closure, and it's never reached by
`require "y2storage"` either (`y2partitioner.rb`/`y2partitioner/` is a sibling of, not nested under,
`y2storage/` in upstream's `lib/` tree). The interactive `y2storage/dialogs/guided_setup/*` wizard
tree (17 files) and `y2storage/dialogs/proposal.rb` are likewise never reached and were not vendored;
neither was the latter's `y2storage/setup_errors_presenter.rb` helper (only reached from that
unvendored dialog and from `clients/inst_disk_proposal.rb`, also unvendored).

`Installation::FinishClient` (the common base class for finish steps) and
`installation/autoinst_profile/{section_with_attributes,element_path}.rb` (required by every
`y2network/autoinst_profile/*_section.rb` file above) are **not** vendored here: they are provided by
the base `yast2` package, which remains a real runtime dependency of Agama.
`cfa`/`cfa_grub2` (used extensively by the bootloader backends for config-file editing) are not
YaST packages - they're already-declared direct gem dependencies in `agama-yast.gemspec`, unaffected
by this vendoring.

**`yast2-s390`'s UI/classic-module layer is not vendored.** `dasds_writer.rb`, `dasd_actions/*.rb`,
`presenters/dasd_summary.rb`, the `dialogs/`/`include/` tree and the classic `modules/
DASDController.rb`/`modules/ZFCPController.rb` modules are all interactive-UI-only or only reachable
from them - Agama's own `service/lib/agama/storage/dasd/`, `service/lib/agama/storage/zfcp/` drive
DASD/zFCP configuration directly through the lower-level classes vendored above (`Dasd`,
`DasdsCollection`, `DasdsReader`, `FormatProcess`, `ZFCP`), not through `DasdsWriter`/`DasdActions`.

**`yast2-iscsi-client`'s UI layer is not vendored.** `modules/IscsiClient.rb` (capital-only, the
interactive YaST wizard/sequencer client that wraps `IscsiClientLib` for the UI workflow) is a
separate, distinct module from `IscsiClientLib` and is never referenced anywhere in Agama's code.

**`yast2-bootloader`'s UI/dialog/widget layer is not vendored**: `*_widgets.rb`, `*_dialog*.rb`,
`main_dialog.rb`, `read_dialog.rb`, `write_dialog.rb`, `config_dialog.rb`, `proposal_client.rb`,
`auto_client.rb` and their `autoyast_converter.rb`/`autoinst_profile/*.rb` AutoYaST-import
counterparts (see "Deliberate deviations from upstream" above) are all interactive-UI-only or only
reachable from the removed `Export`/`Import` methods.

**`yast2-users` is not vendored at all.** `Y2Users::User` unconditionally requires a chain that ends
in `Yast.import "UsersSimple"`, a Perl module that only exists inside `yast2-users` itself, so
merely loading the class would hard-crash without that package installed - for functionality
(password/account validation) Agama never uses. Given Agama only reads a handful of plain fields
from the raw profile hash (root/first regular user's name, password, and SSH keys),
`service/lib/agama/autoyast/users_profile_reader.rb` reads the `<users>` section directly instead.
The one piece of behavior it does replicate from `Y2Users::User#system?` - treating a user with a
low enough explicit uid as a "system" user - reuses `Yast::ShadowConfig`, which lives in the base
`yast2` package (not `yast2-users`), so it adds no dependency either.

## Base yast2

Base `yast2` (5.0.21) is vendored unit by unit. Every unit is a pair of commits: a *copy* commit
(`Vendor X from yast2`, byte-identical to upstream, verifiable with `diff` against
`yast-yast2/library/<pkg>/src/...`) and one or more *adaptation* commits (test header/helper
changes, then removal of methods nothing in Agama calls). The `yast2` RPM `Requires:` is dropped
only in the last commit of the series.

Where upstream tests exist they are ported to `test/YaST2/{modules,lib/...}`; fixtures live under
`test/fixtures/yast2`. Tests for removed methods are removed together with the methods.

### Infrastructure (`lib/yast2`)

`equatable.rb`, `execute.rb`, `refinements/string_manipulations.rb`, `secret_attributes.rb`,
`rel_url.rb`, `system_time.rb`, `target_file.rb`. Only deviation: a non-ASCII bullet in a comment of
`string_manipulations.rb` was replaced by `*` (`rake pot` fails on non-ASCII bytes). No upstream test
exists for `target_file.rb` and `string_manipulations.rb`.

### Classic modules

`Mode`, `Stage`, `Arch`, `Directory`, `Encoding`, `Label`, `Summary`, `HTML`, `String`, `Map`,
`URLRecode`, `IP`, `FileUtils`, `Misc`, `Icon`, `OSRelease`, `Hostname`, `URL`.

Methods that nothing in Agama calls were removed (see each "Drop unused methods from X" commit for
the list), e.g. all `Arch.board_*`/`rpm_arch`, `IP.Check*`/`Valid4`/`Valid6`/`reserved4` (and with
them the `Netmask` import), most of `String` (formatting/table/padding helpers; `Quote`,
`FormatSize*`, `CutBlanks`, `Repeat`, `CutRegexMatch`, `FirstChunk`, `Replace` and `FormatFilename`
remain). The upstream test examples for the removed methods were removed too.

`test_helper.rb` sets `ENV["LANG"]` and `ENV["LC_NUMERIC"]="C"` instead of `ENV["LC_ALL"]`:
`Builtins::Float.tolstring` formats according to the *current* numeric locale and a non-empty
`LC_ALL` would override `LC_NUMERIC`.
`URL_test.rb` disables `Layout/LineLength` for the whole file (aligned upstream data tables).
