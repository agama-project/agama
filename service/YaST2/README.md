# Vendored YaST/AutoYaST code

This directory contains a **permanent fork** of the YaST Ruby code that Agama's service still
relies on: the base `yast2` package and several other YaST packages (AutoYaST, installation,
network, s390, iSCSI, bootloader, storage and packager). Agama no longer depends on those RPMs;
the parts it needs were copied here instead.

There is **no process to keep this code in sync with upstream YaST**. If a bug is found here, or a
new feature is needed, fix or extend the code directly in this directory.

Only what Agama actually reaches was vendored. Interactive UI code, wizards and workflow engines
were left out, and so were methods that nothing in Agama calls. Where code was removed or changed,
the commit message explains why; `git log -- service/YaST2` is the place to look for details.

## Layout

The directory mirrors the upstream source trees, so the code is easy to compare with the original:

- `modules/`, `include/` and `scrconf/` are resolved through `ENV["Y2DIR"]`, which the executables
  in `bin/` set. They hold classic `Yast.import "X"` modules, legacy `Yast.include` files and SCR
  agent registrations (`.scr`).
- `lib/` is added to the gem's `require_paths` (see `agama-yast.gemspec`), so a plain
  `require "y2storage"` finds it.
- `xslt/` holds static support files that are not loaded through either mechanism.

## Tests

`service/test/YaST2/` mirrors this directory and contains the upstream tests, adapted to run
against these copies. Their fixtures live under `service/test/fixtures/yast2/`. Tests were written
from scratch only where upstream has none and the code is non-trivial or was modified here.

Upstream suites rely on global `RSpec.configure` hooks. Those are not appropriate for the shared
Agama suite, so they were turned into opt-in shared contexts that only the ported specs include.

## Not vendored

Some YaST pieces are not Ruby code and cannot be vendored. They remain regular RPM dependencies,
declared in `service/package/gem2rpm.yml`: the native bindings (`libstorage-ng-ruby`,
`yast2-pkg-bindings`, `yast2-ycp-ui-bindings`) and `yast2-transfer` (native curl/tftp agents).

`yast2-packager` must never be declared as a dependency: it requires `yast2-storage-ng` back, which
would defeat the purpose of vendoring.

## Things to keep in mind when changing this directory

- Vendored code may rely on files that were available only because a YaST package was installed
  (for example SCR agent files or Augeas lenses). A development machine that still has those
  packages can hide such gaps, so check CI, which runs in a clean container built from
  `gem2rpm.yml`.
- Files must stay ASCII-only (`rake pot` fails on non-ASCII bytes).
- Classic modules are global singletons: specs that change their state (`Mode`, `Stage`, `Arch`,
  `ProductFeatures`...) must restore it.
- The test suite uses `# frozen_string_literal: true`. Upstream tests that mutate strings in place
  need a mutable copy (unary `+`).
