# Plan: remove YaST dependencies

See spec.md for the context and goal of this feature.

## Current architecture (analysis)

Agama has already migrated most subsystems off YaST onto native Rust, running in-process inside
`agama-manager` (embedded in the `agama-web-server` binary):

| Subsystem | Status |
|---|---|
| Network | Native Rust (`agama-network`) - talks directly to NetworkManager over D-Bus |
| Users/root | Native Rust (`agama-users`) - `useradd`/`chpasswd` via chroot; the old Ruby users D-Bus service was deleted |
| NTP | Native Rust (`agama-ntp`) - drives `chronyd`/`chronyc` directly |
| Security (certs) | Native Rust (`agama-security`) - uses the `openssl` crate |
| Hostname | Native Rust (`agama-hostname`) - talks to `org.freedesktop.hostname1` |
| Software/zypp | Native Rust (`agama-software`, `zypp-agama`) - direct libzypp bindings |
| Files/scripts application, proxy, l10n | Native Rust |
| **Storage** (partitioning, DASD, zFCP, iSCSI, bootloader) | Still Ruby + YaST. `org.opensuse.Agama.Storage1` D-Bus service, deeply built on `Y2Storage` (Agama's proposal classes literally subclass `Y2Storage::Proposal::*`), plus `yast2-bootloader`, `yast2-s390`, `yast2-iscsi-client`. The Rust crates `agama-storage`, `agama-bootloader`, `agama-s390`, `agama-iscsi` are thin D-Bus **clients only** - no logic has been ported to Rust. |
| **AutoYaST profile parsing** | Still Ruby + YaST. Standalone `agama-autoyast` executable, invoked by the Rust side (`agama-server`'s `/api/profile/autoyast` HTTP endpoint, via `Command::new("agama-autoyast")`) only when an `inst.auto=` profile is XML. Converts XML into Agama JSON (`autoinst.json`), which Rust then loads exactly like a normal profile (`agama config load`). |

Runtime flow for AutoYaST profiles: `agama-autoinstall` (Rust) -> HTTP -> `agama-web-server` (Rust)
-> shells out to `agama-autoyast` (Ruby) -> `Agama::AutoYaST::Converter` + section readers ->
`autoinst.json` -> Rust `agama config load`.

### Dependency inventory

Package chain declared today (`service/package/gem2rpm.yml`, `setup-services.sh`):

```
autoyast2-installation, yast2, yast2-bootloader, yast2-country, yast2-hardware-detection,
yast2-installation, yast2-iscsi-client, yast2-network, yast2-proxy, yast2-storage-ng,
yast2-users (dev setup only), + on s390: yast2-s390, yast2-reipl, yast2-cio
```

Why each is needed today:

- **`yast2-storage-ng`, `yast2-bootloader`, `yast2-s390`, `yast2-iscsi-client`** - legitimately
  load-bearing. Agama's storage proposal (`service/lib/y2storage/agama_proposal.rb` and friends) is
  built *inside* `Y2Storage`'s own proposal framework (planners/creators), and bootloader/DASD/zFCP/
  iSCSI logic reuses `::Bootloader::BootloaderFactory`, `Y2S390::Dasd`/`Y2S390::ZFCP`,
  `Yast::IscsiClientLib`. These are the packages Agama and the YaST team actively co-maintain.
  **Out of scope for removal.**

- **`yast2-installation`** - used only for 5 thin "finish client" wrappers dispatched via
  `Yast::WFM.CallFunction`: `storage_finish`, `umount_finish`, `inst_bootloader`,
  `iscsi-client_finish`, `cio_ignore_finish`. All 5 are 2-10 line dispatch shims; the real logic
  sits in `Y2Storage::Clients::Finish` (storage-ng, kept), `::Bootloader::BootloaderFactory`
  (bootloader, kept), `Y2IscsiClient::FinishClient` (iscsi-client, kept), and
  `Installation::Unmounter`/`Installation::CIOIgnore` (genuinely defined in yast2-installation,
  non-trivial logic). Also used for `Yast::Installation.destdir`.

- **`autoyast2-installation`** (the big one) - every class Agama's AutoYaST layer uses
  (`Yast::AutoinstConfig`, `Yast::Profile`/`ProfileHash`, `Yast::ProfileLocation`,
  `Yast::AutoInstallRules`, `Y2Autoinstall::ScriptRunner`, `Y2Autoinstallation::PreScript`) lives
  **exclusively** in the `-installation` subpackage, never in the lightweight base `autoyast2`
  package. This subpackage's own `Requires:` pull in `yast2-country`, `yast2-packager`,
  `yast2-services-manager`, `yast2-ntp-client`, `yast2-slp`, `yast2-update`, plus (via the
  `autoyast2` base package) `yast2-security`, `yast2-network`. Combined with `yast2-installation`'s
  own chain (`yast2-users`, `yast2-security`, `yast2-proxy`...), this is where the bulk of unrelated
  packages come from - even though Agama's own section readers (`ntp_client_reader.rb`,
  `hostname_reader.rb`, `security_reader.rb`, `services_manager_reader.rb`) already reimplement
  that domain logic as plain hash-to-JSON transforms and never call into those packages' APIs.
  Two exceptions do use typed YaST classes for parsing: `network_reader.rb`/`connections_reader.rb`/
  `wireless_reader.rb` (`Y2Network::AutoinstProfile::*`) and `root_reader.rb`/`user_reader.rb`
  (`Y2Users::Autoinst::Reader`).

- **`yast2-country`, `yast2-hardware-detection`, `yast2-proxy`** - declared explicitly in
  `gem2rpm.yml` but **no direct code reference found** in `service/lib`. Almost certainly dead
  weight, kept only because `yast2`/`yast2-installation`/`autoyast2`/`yast2-network` transitively
  require them.

## Scope decisions

- **Out of scope:** replacing `Y2Storage`, `yast2-bootloader`, `yast2-s390`, `yast2-iscsi-client`
  themselves. These form the "storage and friends" stack that Agama and the YaST team actively
  co-maintain going forward. This includes DASD, zFCP, iSCSI and bootloader configuration.
- **In scope:** everything else that Agama's own code directly depends on outside that stack:
  `autoyast2`/`autoyast2-installation`, `yast2-installation`, `yast2-network`, `yast2-users`, and
  the apparently-dead `yast2-country`/`yast2-hardware-detection`/`yast2-proxy` requires.
- **Strategy: vendor, don't chase upstream.** All `yast2-*` packages in scope for removal are
  considered **not actively maintained** from Agama's perspective (whether or not they still see
  upstream commits, Agama will not track them). It is acceptable to duplicate/fork the specific
  code Agama needs directly into the Agama repository. All source packages involved are GPL-2.0,
  copyright SUSE LLC - same license as Agama, so there is no licensing obstacle to vendoring.
- **New component: `service/YaST2`.** A new directory inside the existing `agama-yast` gem (not a
  separate package) holds the forked, Agama-owned copies of the YaST classes listed below. It is a
  **permanent fork**: there is no plan or process to keep it in sync with upstream YaST releases.
  `agama-yast` stops requiring `autoyast2(-installation)`, `yast2-installation`, `yast2-network`
  and `yast2-users` as RPM/system dependencies; the classes it needs from them live under
  `service/YaST2` instead.

### Vendoring mechanism: reuse the existing Y2DIR/`$LOAD_PATH` precedent

Agama already vendors two YaST modules today: `service/lib/agama/y2dir/modules/{Package,PackagesProposal}.rb`
override `Yast::Package`/`Yast::PackagesProposal` by exploiting YaST's own module-search mechanism -
`agamactl` prepends `lib/agama/y2dir` to `ENV["Y2DIR"]`, and `Yast.import "X"` finds
`<Y2DIR>/modules/X.rb` before any system-installed copy. `service/YaST2` follows the same pattern,
extended to also cover plain-`require`-based classes:

```
service/YaST2/
  modules/                          # Yast.import-based singletons -> added to Y2DIR
    AutoinstConfig.rb                # Yast::AutoinstConfig       (was autoinstallation/src/modules/AutoinstConfig.rb)
    AutoinstScripts.rb               # Yast::AutoinstScripts      (was autoinstallation/src/modules/AutoinstScripts.rb)
    Profile.rb                       # Yast::Profile + ProfileHash (was autoinstallation/src/modules/Profile.rb)
    ProfileLocation.rb               # Yast::ProfileLocation      (was autoinstallation/src/modules/ProfileLocation.rb)
    AutoInstallRules.rb              # Yast::AutoInstallRules     (was autoinstallation/src/modules/AutoInstallRules.rb)
  lib/                               # plain `require`-based classes -> added to gem require_paths
    autoinstall/
      script.rb                      # Y2Autoinstallation::Script/PreScript
      script_runner.rb               # Y2Autoinstall::ScriptRunner
    installation/
      finish_client.rb               # Installation::FinishClient
      unmounter.rb                   # Installation::Unmounter
      cio_ignore.rb                  # Installation::CIOIgnore / CIOIgnoreFinish
```

(Phase 2 later adds `lib/y2network/autoinst_profile/...` and `lib/y2users/autoinst/reader.rb` the
same way.)

Wiring needed for this to work:

- `service/agama-yast.gemspec`: `spec.files` gains `"YaST2/**/*.rb"`; `spec.require_paths` becomes
  `["lib", "YaST2/lib"]` so plain `require "autoinstall/script_runner"`,
  `require "installation/unmounter"`, etc. resolve to the vendored files.
- `service/bin/agama-autoyast`: currently does **not** set `Y2DIR` at all (only `agamactl` does).
  It needs `ENV["Y2DIR"] = [ENV.fetch("Y2DIR", nil), File.expand_path("../YaST2", __dir__)].compact.join(":")`
  added, mirroring `agamactl`'s existing pattern, so `Yast.import "AutoinstConfig"` (and friends)
  resolve to the vendored `modules/` files. This is the only place that needs the change: the
  storage D-Bus service (`agamactl storage`) only uses the `lib/`-style classes, which resolve via
  gem `require_paths` regardless of `Y2DIR`.
- Original namespaces (`Yast::`, `Installation::`, `Y2Autoinstall::`, `Y2Autoinstallation::`) are
  kept unchanged - required for `Yast.import` to resolve and for other kept YaST code to keep
  referencing these classes normally.

With this in place, **existing call sites need no changes** (`Yast.import "AutoinstConfig"` in
`profile_fetcher.rb`, `require "installation/cio_ignore"` in `finisher.rb`, etc. keep working
as-is). The only call-site changes left are the 5 `Yast::WFM.CallFunction(...)` dispatch calls
(task 8 below), which must change regardless of vendoring since bypassing WFM's client-search
mechanism is the whole point of that step.

### Classes to vendor into `service/YaST2`

| Source package | Classes | Destination |
|---|---|---|
| `autoyast2` (base + `-installation`) | `Yast::AutoinstConfig`, `Yast::AutoinstScripts`, `Yast::Profile`/`Yast::ProfileHash`, `Yast::ProfileLocation`, `Yast::AutoInstallRules`, `Yast::AutoinstFunctions` | `service/YaST2/modules/*.rb` |
| `autoyast2` (base + `-installation`) | `Y2Autoinstall::ScriptRunner`, `Y2Autoinstallation::PreScript`/`Script`, `Y2Autoinstallation::XmlChecks`, `Y2Autoinstallation::XmlValidator`, `Y2Autoinstallation::Y2ERB`, `Y2Autoinstallation::Entries::Registry`/`Description` | `service/YaST2/lib/autoinstall/**/*.rb` |
| `autoyast2` (base + `-installation`) | `Yast::AutoinstallXmlInclude`, `Yast::AutoinstallIoInclude` (legacy `Yast.include` files) | `service/YaST2/include/autoinstall/*.rb` |
| `autoyast2` (base + `-installation`, third-party LGPL stylesheet) | `merge.xslt` (static XSLT, not Ruby; used by `AutoInstallRules` via `xsltproc`) | `service/YaST2/xslt/merge.xslt`, resolved by `AutoInstallRules.rb` relative to its own `__dir__` (no `install.sh`/RPM step needed) |
| `yast2-installation` | `Installation::Unmounter`, `Installation::Clients::UmountFinishClient`, `Installation::CIOIgnore`/`CIOIgnoreFinish`, `Yast::Transfer::FileFromUrl` | `service/YaST2/lib/installation/*.rb`, `service/YaST2/lib/transfer/file_from_url.rb` |
| `yast2-services-manager` | `Yast::ServicesManagerTargetClass::BaseTargets` (only this nested module is used, by `AutoinstConfig`; the rest of the class - reading/writing the systemd default target - is unused dead code, kept only because `Yast.import` needs the whole file to load) | `service/YaST2/modules/ServicesManagerTarget.rb` |
| `yast2-network` (Phase 2) | `Y2Network::AutoinstProfile::NetworkingSection` + all its sub-sections (interfaces/interface/alias, routing/route, udev-rules/udev-rule, s390-devices/s390-device - the latter three are unused by Agama's readers but load-bearing since `new_from_hashes` unconditionally instantiates them), `Y2Network::BootProtocol`, `Y2Network::IPAddress`, `Y2Network::Startmode` (+ the `startmodes/*` family), `Y2Network::WirelessAuthMode`, `Y2Network::WirelessMode` - 23 files, ~2420 lines, no `Yast.import` calls (100% plain `require`), no non-Ruby assets | `service/YaST2/lib/y2network/**/*.rb` |
| `yast2-users` (Phase 2) | **Not vendored.** `Y2Users::User` unconditionally requires `user_validator.rb` -> `validation_config.rb`, which does `Yast.import "UsersSimple"` eagerly at class-load time - `UsersSimple` is a **Perl module that only exists inside `yast2-users` itself**, so a straight vendor would need to surgically fork `User` to strip that chain (plus `password_validator.rb`/cracklib-dependent code) across a ~2900-line/23-file `Config`/`Collection`/`User`/`Group`/`Password` object graph, to serve a usage surface of exactly 5 fields on root + the first regular user. Replaced instead by a small Agama-owned parser reading `profile.fetch_as_array("users")` directly - see the Phase 2 task breakdown. | `service/lib/agama/autoyast/users_reader.rb` (new, native Agama code, not vendored) |

Each vendoring task starts with a **dependency-closure audit**: trace every `require`/`Yast.import`
in the target class, and either (a) vendor the transitive piece too, (b) confirm it resolves to
something already kept (`yast2` base, `yast2-storage-ng`), or (c) drop/stub unused code paths (e.g.
UI/dialog/wizard-only logic in `AutoinstConfig`/`Profile` that Agama never exercises). Keep a
comment at the top of each vendored file noting its original upstream path, for provenance.

**Lesson learned during Phase 1 implementation:** the dependency-closure audit goes deeper than
just `.rb` files reachable via `require`/`Yast.import` from the "obvious" entry points -
`AutoinstConfig.rb` alone pulled in a static XSLT stylesheet (via a hardcoded absolute path, not a
Ruby `require`), a whole extra YaST module (`yast2-services-manager`, via `Yast.import
"ServicesManagerTarget"` executed eagerly at load time), and two legacy `Yast.include` files
(`autoinstall/xml.rb`, `autoinstall/io.rb`, a different loading mechanism than both `Yast.import`
and plain `require`). The only reliable way to find all of these is to actually boot the vendored
code with the real RPMs *not* installed and fix load errors one by one (see Phase 0/validation
below), not just a static grep of `require`/`Yast.import` statements.

One dead code path was intentionally *not* vendored: `Yast::AutoinstConfig#find_slp_autoyast`
(SLP-based profile auto-discovery) was removed along with its `Yast.import "SLP"`, since `yast2-slp`
is not even packaged in current openSUSE Tumbleweed anymore and Agama's `ProfileFetcher` always
receives an explicit profile URL.

`yast2-iscsi-client` stays as part of the kept "storage and friends" stack (not vendored, not
rewritten) - Agama's `service/lib/agama/storage/iscsi/adapter.rb` keeps using
`Yast::IscsiClientLib` as-is. `Installation::FinishClient` is *not* vendored either: it lives in the
base `yast2` package (`yast2/library/general`), not `yast2-installation`, so it's already covered by
the kept `yast2` dependency. `yast2-xml` (providing `Yast::XML`, used by the vendored
`xml_validator.rb`/`AutoInstallRules.rb`) is also not vendored - it is expected to keep arriving
transitively as a dependency of other kept/vendored code, and is treated as an accepted residual
like `yast2-packager` (see the priority/risk table below).

## Phased roadmap

### Phase 0 - Verification tooling

A repeatable way to prove a package is no longer pulled onto the installation media after each
phase, since RPM's dependency solver keeps a transitively-required package installed until every
package that requires it is gone. For example:

- Build the installer image and use `rpm -q --whatrequires`/`rpm -e --test` to check what a
  candidate package removal would break.
- Capture `$LOADED_FEATURES` (or similar) during `agama-autoyast` test runs and real storage
  operations, to get an evidence trail of which YaST Ruby files are actually loaded at runtime.

### Phase 1 - Vendor the AutoYaST core + finish-client glue

See the detailed task breakdown below.

### Phase 2 - Vendor `yast2-network` profile-parsing classes; reimplement `yast2-users` parsing natively

See the detailed task breakdown below.

### Phase 3 - Drop now-dead transitive RPM requires

Re-run Phase 0 verification against `yast2-country`, `yast2-hardware-detection`, `yast2-proxy` (no
direct code references found in `service/lib` today). Remove from `gem2rpm.yml`/kiwi file where
proven safe. Expect `yast2-hardware-detection` to remain unavoidable (required by the base `yast2`
package itself, which stays for `Y2Storage`/`Bootloader`), but `yast2-country` and `yast2-proxy`
should be droppable once Phases 1-2 remove their pullers (`autoyast2`, `yast2-installation`,
`yast2-network`).

### Phase 4 - Documentation & packaging cleanup

- Final expected dependency set: `yast2`, `yast2-storage-ng`, `yast2-bootloader`,
  `yast2-iscsi-client`, (`yast2-s390`/`yast2-reipl`/`yast2-cio` on s390), plus the vendored code
  under `service/YaST2` (part of the existing `agama-yast` gem, no new package).
- Update `gem2rpm.yml`, `service/agama-yast.spec.in`, `setup-services.sh`,
  `live/src/agama-installer.kiwi`.
- Update spec.md/plan.md to describe the final architecture: storage/bootloader/DASD/zFCP/iSCSI as
  the sole remaining, actively co-maintained YaST dependency; everything else forked permanently
  into `service/YaST2` with no upstream-sync process.
- Report the installer-medium package-count/size delta as the success metric.

## Priority / risk table

| Phase | Effort | Risk | Payoff |
|---|---|---|---|
| 0 (tooling) | S | Low | Prerequisite for trusting every later removal |
| 1 (vendor autoyast2 + installation glue) | L | Low (no drift concern) | Removes `autoyast2`(-installation) + `yast2-installation` and their multi-package transitive chain (country, packager, services-manager, ntp-client, slp, update, security, users, proxy) |
| 2 (vendor network parsing, reimplement users parsing) | M | Low for network (no drift concern, no `Yast.import`); Low-Medium for users (new custom code, needs test coverage for root/user selection edge cases) | Removes `yast2-network`, `yast2-users` |
| 3 (drop dead requires) | S | Low | Final trim (`yast2-country`, `yast2-proxy`) |
| 4 (docs/packaging) | S | Low | Closes the loop, locks in the metric |

Note: `yast2-packager` will likely remain on the media regardless, since `yast2-storage-ng`/
`yast2-bootloader` (kept) require it directly - accepted residual, not something to vendor since
Agama's own code never touches it.

## Open items to track during execution

- Confirm `AutoinstConfig`'s `require "y2packager/product"` and `Profile.rb`'s
  `Yast.import "ProductControl"` don't force an unwanted hard dependency - vendor or stub as needed.
- `Yast::AutoInstallRules` depends on the existing `Agama::AutoYaST::StorageManager` fake shim
  (`service/lib/agama/autoyast/storage_manager.rb`) - keep it in sync with the vendored
  `AutoInstallRules`.
- `Installation::Unmounter`/`Installation::CIOIgnore` are genuinely non-trivial logic - vendor as-is
  in Phase 1, no attempt to simplify in the same change.
- Only `bin/agama-autoyast` needs the new `Y2DIR` entry; double check no other entry point (tests,
  `agamactl`) ends up needing `Yast.import` on the vendored `modules/*.rb` classes too.
- Document at the top of `service/YaST2` (e.g. a `README.md` there) that it is a permanent fork of
  specific YaST/AutoYaST classes, so future contributors don't assume it auto-updates from YaST
  releases.
- **Pitfall found during implementation:** `ENV["Y2DIR"]` must be set *before* `require "yast"` is
  executed anywhere in the process. The Y2DIR search path list is read from the environment once
  and cached in a C++ static (`Y2PathSearch::initializePaths()` in yast2-core's `pathsearch.cc`,
  only calls `getPaths()` if the cached `paths` vector is still empty), and that caching is
  triggered as a side effect of loading the `yast` gem/its native extension. Setting `Y2DIR` after
  `require "yast"` is silently ignored - `Yast.import` then fails with
  `component cannot import namespace 'X'` for every vendored `modules/*.rb` class. This was
  reproduced by moving `require "yast"` back before the `ENV["Y2DIR"]` assignment in
  `bin/agama-autoyast` and running the real executable (not just the RSpec suite, which never
  exercises this script and uses its own, correctly-ordered `Y2DIR` setup in `test_helper.rb`).
  Both `agamactl` (unmodified) and `test_helper.rb` already had the correct order; only
  `bin/agama-autoyast` needed fixing. **Takeaway:** whenever `Y2DIR` is set in an entry point,
  always place it before the first (even indirect) `require "yast"`, and validate by running the
  actual entry point/executable, not just specs that `require` the underlying classes directly.
- **Second pitfall found during implementation:** the initial vendoring of `merge.xslt` hardcoded
  `MERGE_XSLT_PATH` to the same absolute OS path the original `autoyast2-installation` package used
  (`/usr/share/autoinstall/xslt/merge.xslt`), and relied on `install.sh` to copy the vendored file
  there. This only works when the full RPM has actually been installed (`install.sh` is only run
  from the RPM's `%install` step) - it silently doesn't exist in a plain git checkout/bundler
  context, which is exactly how the RSpec suite (and most manual testing) runs. Fixed by resolving
  `MERGE_XSLT_PATH` relative to `AutoInstallRules.rb`'s own `__dir__` instead, removing the
  `install.sh`/RPM `%files` entries entirely. **Takeaway:** any vendored *non-Ruby* asset referenced
  by an absolute path must be re-pointed to resolve relative to the vendored file's own location,
  the same way Ruby code resolves via `Y2DIR`/`require_paths` - do not keep an upstream's hardcoded
  absolute path.

## Phase 1 task breakdown

**Status: implemented** (branch `drop-yast-phase1`). Validated by running the full `service/`
RSpec suite (2817 examples) inside a fresh openSUSE Tumbleweed container with `autoyast2`,
`autoyast2-installation`, `yast2-installation`, `yast2-services-manager` and `yast2-slp` all
**not installed** - see the "Classes to vendor" section above for the final, actual list of
vendored files (a few more than originally estimated were needed - `AutoinstFunctions`,
`ServicesManagerTarget`, the two `Yast.include` files, and `merge.xslt`).

Goal: remove the `autoyast2-installation` and `yast2-installation` RPM dependencies by vendoring
the classes Agama needs into `service/YaST2` (inside the existing `agama-yast` gem), wiring it up
via the `Y2DIR`/`$LOAD_PATH` mechanism already used by `service/lib/agama/y2dir`, and by replacing
the `Yast::WFM.CallFunction`-based "finish client" dispatch with direct calls.

The task list below is kept as originally planned, for the historical record; see the "Classes to
vendor" table above for what was actually shipped (`Installation::FinishClient` from task 7 turned
out to already be part of the kept `yast2` package, not `yast2-installation`, so it was not
vendored).

1. **Scaffold `service/YaST2` and wire it into the gem.**
   - Create `service/YaST2/modules/` and `service/YaST2/lib/` (empty for now).
   - Update `service/agama-yast.gemspec`: add `"YaST2/**/*.rb"` to `spec.files`, and set
     `spec.require_paths = ["lib", "YaST2/lib"]`.
   - Update `service/bin/agama-autoyast` to set `Y2DIR` the same way `agamactl` does:
     `ENV["Y2DIR"] = [ENV.fetch("Y2DIR", nil), File.expand_path("../YaST2", __dir__)].compact.join(":")`.
   - Add a short `service/YaST2/README.md` stating this is a **permanent fork** of specific
     YaST/AutoYaST classes (with upstream source paths noted per file), not kept in sync with
     upstream releases.

2. **Audit and vendor `Yast::AutoinstConfig`.**
   - Copy `autoinstallation/src/modules/AutoinstConfig.rb` to `service/YaST2/modules/AutoinstConfig.rb`.
   - Trace its `require "y2packager/product"` and `Yast.import` list (`SLP`, `URL`, `Misc`, `Mode`,
     `Installation`, `Stage`, `Label`, `Report`, `UI`); confirm which are satisfied by the kept
     `yast2` base package and which need stubbing/removal (this class is loaded during profile
     fetch/bootstrap, well before any real UI exists in Agama).
   - Strip dead code paths not exercised by Agama (SLP-based profile discovery is unlikely to be
     used; confirm with the `ProfileFetcher` call sites before removing).

3. **Audit and vendor `Yast::AutoinstScripts`.**
   - Copy `autoinstallation/src/modules/AutoinstScripts.rb` to
     `service/YaST2/modules/AutoinstScripts.rb`.
   - Its `require "autoinstall/script"` keeps working unchanged once task 6's files are in place
     under `service/YaST2/lib/autoinstall/script.rb`. Confirm `Yast.import` list (`AutoinstConfig`,
     `Summary`, `URL`, `Popup`, `Label`, `Report`, `UI`, `Mode`) against what's kept vs. needs
     stubbing.

4. **Audit and vendor `Yast::Profile`/`Yast::ProfileHash`.**
   - Copy `autoinstallation/src/modules/Profile.rb` to `service/YaST2/modules/Profile.rb` (defines
     both classes in the same file).
   - Resolve `require "yast2/popup"`, `"autoinstall/entries/registry"`,
     `"installation/autoinst_profile/element_path"`, `"ui/password_dialog"` - check which of these
     are already replaced by Agama's own `report_patching.rb` monkey-patches and can be simplified.
   - Confirm `Yast.import "ProductControl"` resolves via the kept `yast2` base package (it's part
     of core yast2's control library, not `yast2-installation`/`autoyast2`) and does not need
     vendoring itself.

5. **Audit and vendor `Yast::ProfileLocation` and `Yast::AutoInstallRules`.**
   - Copy `autoinstallation/src/modules/ProfileLocation.rb` and
     `autoinstallation/src/modules/AutoInstallRules.rb` to `service/YaST2/modules/`.
   - `AutoInstallRules` is the `<rules>`/`<classes>` matching engine; it calls
     `Y2Storage::StorageManager.instance.probed.disks`,
     `Y2Storage::StorageManager.instance.probed_disk_analyzer`, and `Y2Storage::Arch.new.efiboot?`.
     Verify Agama's existing fake shim `Agama::AutoYaST::StorageManager`
     (`service/lib/agama/autoyast/storage_manager.rb`) already satisfies everything this class
     needs (it was built for exactly this purpose) and keep both in sync going forward.
   - Resolve remaining `Yast.import` list (`Arch`, `Stage`, `Installation`, `AutoinstConfig`, `XML`,
     `Kernel`, `Mode`, `Linuxrc`, `Profile`, `Label`, `Report`, `Popup`, `URL`, `IP`, `Product`)
     against kept vs. stub-needed.

6. **Audit and vendor `Y2Autoinstall::ScriptRunner` and `Y2Autoinstallation::PreScript`/`Script`.**
   - Copy `autoinstallation/src/lib/autoinstall/script_runner.rb` and the relevant classes from
     `autoinstallation/src/lib/autoinstall/script.rb` to `service/YaST2/lib/autoinstall/`.
   - Note `PreScript`'s `require "transfer/file_from_url"` (yast2-transfer) - confirm whether
     `rust/agama-transfer`'s already-ported URL-scheme handlers can replace it, or whether
     `yast2-transfer` needs to be vendored/kept too.
   - `service/lib/agama/autoyast/pre_script.rb` (Agama's existing subclass) needs no change - it
     will keep resolving `Y2Autoinstallation::PreScript` via the updated `require_paths`.

7. **Vendor the `yast2-installation` finish-client classes.**
   - Copy `installation/src/lib/installation/finish_client.rb` (base dispatch class),
     `installation/src/lib/installation/unmounter.rb`, and
     `installation/src/lib/installation/cio_ignore.rb` (specifically `Installation::CIOIgnore` and
     `Installation::CIOIgnoreFinish`; the UI-only `Installation::CIOIgnoreProposal` can be dropped)
     to `service/YaST2/lib/installation/`.
   - Keep `Installation::Unmounter` and `Installation::CIOIgnore`/`CIOIgnoreFinish` logic as-is
     (both are genuinely non-trivial; no simplification in this phase).

8. **Replace `Yast::WFM.CallFunction` dispatch with direct calls.**
   - `service/lib/agama/storage/finisher.rb`: replace `Yast::WFM.CallFunction("storage_finish", ...)`
     with a direct call into `Y2Storage::Clients::Finish` (kept package, storage-ng); replace
     `Yast::WFM.CallFunction("iscsi-client_finish", ...)` with a direct call into
     `Y2IscsiClient::FinishClient` (kept package); replace the dynamic
     `require "installation/cio_ignore"` + WFM dispatch with a direct call to the vendored
     `Installation::CIOIgnoreFinish`.
   - `service/lib/agama/storage/umounter.rb`: replace `Yast::WFM.CallFunction("umount_finish", ...)`
     with a direct call using the vendored `Installation::Unmounter`
     (`Installation::Clients::UmountFinishClient` or an Agama-side equivalent wrapper).
   - `service/lib/agama/storage/bootloader_manager.rb`: replace
     `Yast::WFM.CallFunction("inst_bootloader", [])` with a direct call to
     `::Bootloader::BootloaderFactory.current.write_sysconfig(prewrite: true)` (kept package,
     replicating the small `Mode.update` guard from the original client).

9. **Sanity-check `service/lib/agama/autoyast/*` requires.**
   - `profile_fetcher.rb`, `converter.rb`, `pre_script.rb`, `report_patching.rb` should need no
     `require`/`Yast.import` changes since the vendored classes keep the same names/paths. Just
     verify nothing else in `service/lib` requires `autoyast2`/`yast2-installation` files under a
     path not covered by `service/YaST2`.

10. **Drop the RPM dependencies.**
    - Remove `autoyast2-installation` and `yast2-installation` from `service/package/gem2rpm.yml`,
      `setup-services.sh`, and `live/src/agama-installer.kiwi`.
    - Run Phase 0 tooling to confirm neither package is still pulled onto the media by something
      else Agama depends on.

11. **Validation.**
    - Run the full AutoYaST profile-conversion test suite (`service/test`) against the vendored
      classes.
    - Perform a real install run (VM or container) driven by representative AutoYaST profiles
      exercising: profile fetch (URL + rules/classes matching), pre-scripts, storage/iSCSI/bootloader
      finish steps, and unmount, to validate behavior parity end-to-end.
    - Update/extend existing RSpec tests to cover the vendored classes directly (they currently may
      rely on the system-installed YaST gems being present in the test environment; make sure specs
      now exercise the vendored code paths, and that the test setup also sets `Y2DIR` to
      `service/YaST2` where needed).

## Phase 2 task breakdown

**Branch:** `drop-yast-phase2`, based on `drop-yast-phase1` (needs the `service/YaST2` scaffolding,
gemspec `require_paths`, and Y2DIR wiring from Phase 1).

Goal: remove the `yast2-network` and `yast2-users` RPM dependencies. Unlike Phase 1, this splits
into two different strategies per package:

- `yast2-network`: straight vendoring, like Phase 1 - the dependency-closure audit found **zero**
  `Yast.import` calls and **zero** non-Ruby assets anywhere in the AutoYaST-parsing closure, so this
  is materially simpler than Phase 1's `autoyast2` work.
- `yast2-users`: **not vendored**. `Y2Users::User` unconditionally requires a chain that ends in
  `Yast.import "UsersSimple"`, a Perl module that only exists inside `yast2-users` itself - so even
  a class Agama never calls (`user.issues`/`password.issues`) would hard-crash `require "y2users/user"`
  the moment `yast2-users` is uninstalled. Combined with Agama's narrow actual usage (5 fields on
  root + the first regular user, no groups, no multiple users, no password aging), a small
  Agama-owned reimplementation is the better trade-off over surgically forking a ~2900-line/23-file
  object graph. See "Classes to vendor" above for the full rationale.

1. **Vendor the `yast2-network` AutoYaST-parsing closure.**
   Copy these 23 files (source paths relative to `network/src/lib/` in the yast2-network repo) into
   `service/YaST2/lib/y2network/...` (mirroring the upstream relative layout), with the usual
   provenance comment at the top of each:
   - `y2network/autoinst_profile/networking_section.rb`
   - `y2network/autoinst_profile/dns_section.rb`
   - `y2network/autoinst_profile/interfaces_section.rb`
   - `y2network/autoinst_profile/interface_section.rb`
   - `y2network/autoinst_profile/alias_section.rb`
   - `y2network/autoinst_profile/routing_section.rb`
   - `y2network/autoinst_profile/route_section.rb`
   - `y2network/autoinst_profile/udev_rules_section.rb`
   - `y2network/autoinst_profile/udev_rule_section.rb`
   - `y2network/autoinst_profile/s390_devices_section.rb`
   - `y2network/autoinst_profile/s390_device_section.rb`
   - `y2network/boot_protocol.rb`
   - `y2network/ip_address.rb`
   - `y2network/startmode.rb`
   - `y2network/startmodes.rb`
   - `y2network/startmodes/{auto,hotplug,ifplugd,manual,nfsroot,off}.rb` (6 files)
   - `y2network/wireless_auth_mode.rb`
   - `y2network/wireless_mode.rb`

   Do **not** vendor `installation/autoinst_profile/{section_with_attributes,element_path}.rb`
   (every `autoinst_profile/*_section.rb` file requires these) - they live in the kept `yast2` base
   package (`yast2/library/general`), the same way `Installation::FinishClient` did in Phase 1.

   Do **not** vendor anything under `y2network/backends/`, `y2network/wicked/`,
   `y2network/network_manager/`, `y2network/dialogs/`, `y2network/widgets/`, `y2network/sequences/`,
   `y2network/presenters/`, `y2network/connection_config/` (only referenced from the *write*/
   clone-from-live-config path of `interface_section.rb`, never from `new_from_hashes`),
   `y2network/s390_device_activator{,s}/*`, `y2network/wireless_scanner.rb`,
   `y2network/hwinfo.rb`/`driver.rb`/`{physical,virtual}_interface.rb`/`interface.rb`/
   `interfaces_collection.rb`, or `y2network/autoinst/*` (yast2-network's *own* AutoYaST applier,
   profile -> live system config - Agama does not use this, it reimplements the profile -> JSON
   mapping itself and applies configuration via the native Rust `agama-network` crate). All of this
   is the runtime-application side that Agama's Rust code already replaces; vendoring it would be
   pure dead weight.

2. **Sanity-check the vendored `y2network` closure loads standalone.**
   Since this closure has no `Yast.import` calls, no `Y2DIR` change is needed anywhere (unlike
   Phase 1). Verify by requiring `y2network/autoinst_profile/networking_section` directly in a
   container without `yast2-network` installed and confirming no `LoadError`/`NameError`.
   `network_reader.rb`, `connections_reader.rb`, `wireless_reader.rb`, `bond_reader.rb`,
   `bridge_reader.rb`, `vlan_reader.rb` need **no changes** to their `require` statements - they
   already `require "y2network/..."` at the same relative paths that will now exist under
   `service/YaST2/lib/`.

3. **Design and implement a narrow, Agama-owned user/root profile parser.**
   New file, e.g. `service/lib/agama/autoyast/users_reader.rb` (or fold directly into
   `root_reader.rb`/`user_reader.rb` if a shared helper feels like overkill - both currently
   duplicate an near-identical `config` memoization method, so factoring a small shared piece that
   returns "the list of user hashes from the profile" is probably worth it). It must replicate,
   working directly off `profile.fetch_as_array("users")` (confirmed exact shape from existing test
   fixtures: array of hashes with `username`, `fullname`, `user_password`, `encrypted`,
   `authorized_keys` keys - this is already the raw `Yast::ProfileHash` structure, no
   `Y2Users::AutoinstProfile::UserSection` wrapper needed):
   - Root selection: the entry where `username == "root"`.
   - First-regular-user selection: skip the root entry; among the rest, decide how to replicate
     `Y2Users::User#system?` (`name == "nobody"`, or an explicit `system` profile attribute, or -
     the part *not* worth replicating - a real uid-vs-`/etc/login.defs` `SYS_UID_MAX` check, which
     is a live-filesystem-read side effect during "pure" parsing in the original class; recommend
     just checking `name == "nobody"` plus an explicit `"system" => true` attribute if present, and
     documenting the simplification).
   - Field extraction: `username`/`userName`, `fullname`/`fullName` (first whitespace-separated
     word only, matching today's `gecos.first`), `user_password` value, `encrypted` boolean flag,
     `authorized_keys` array.
   - Keep the existing behavior of returning `{}` when no root/no regular user is found, and of
     omitting `password`/`hashedPassword`/`sshPublicKeys` keys when absent (see current
     `root_reader_test.rb`/`user_reader_test.rb` for the exact expected shapes).

4. **Update `root_reader.rb` and `user_reader.rb`.**
   Drop `require "y2users/config"` / `require "y2users/autoinst/reader"` and the
   `Y2Users::Autoinst::Reader.new(profile).read.config` memoized method; use the new parser instead.

5. **Drop the RPM dependencies.**
   - Remove `yast2-network` from `service/package/gem2rpm.yml` and `setup-services.sh`.
   - Remove `yast2-users` from `setup-services.sh` (it never appeared in `gem2rpm.yml`).
   - Re-run the Phase 0 verification approach to confirm neither package is still pulled onto the
     media by something else Agama depends on.

6. **Update `service/YaST2/README.md`.**
   Add the 23 new `y2network` files to the vendored-classes table, with the same "why" as Phase 1's
   entries. Note that `yast2-users` is intentionally absent from `service/YaST2` altogether (link to
   the "Classes to vendor" rationale in this plan, or restate it briefly).

7. **Validation.**
   - Run the full RSpec suite in a container without `yast2-network`/`yast2-users` installed (same
     approach as Phase 1: openSUSE Tumbleweed container, explicit package list minus those two).
   - Existing test fixtures already give solid coverage for the network side (bonding, bridge, VLAN,
     wireless auth/mode, all `BootProtocol`/`Startmode` values, DNS, IP aliases) - no gaps expected,
     but consider adding one test with a profile containing `<routing>`/`<net-udev>`/`<s390-devices>`
     sections to confirm they parse without crashing (nothing exercises them today; they're
     load-bearing only for not raising `NameError` when present).
   - Add test coverage for the new user parser's edge cases that aren't in scope today but that the
     old `Y2Users`-backed code silently supported: confirm the simplified `system?` behavior is
     deliberate and documented, not just "whatever the new code happens to do".
   - As in Phase 1, don't trust a green RSpec suite alone - the Phase 1 postmortem found two real
     bugs (`Y2DIR` ordering, `MERGE_XSLT_PATH`) that only surfaced by running real executables/methods
     directly. For Phase 2, that likely means: actually run `bin/agama-autoyast` against a profile
     exercising bonding/bridge/VLAN/wireless and a `<users>` section end-to-end, not just unit specs.
