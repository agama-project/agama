# Translated strings returned by the D-Bus service

This document lists the translated strings (marked `_()` / `N_()` / `n_()`) that the Agama D-Bus
service can return, with a focus on the ones **not** in the `agama` textdomain. They all come
from the vendored YaST code in `service/YaST2/`.

Scope: only the code in `service/`. External gems and native libraries are ignored. Textdomain
`agama` strings are out of scope (see the last section for a short note).

"Returned" means the text can appear in something the service sends: an issue `description`, a
JSON property, a D-Bus error message, or the text/details of a question the service creates.
Strings that are only logged or shown in a UI that does not exist here are not counted.

## Summary

| Area | Textdomain | Reachable | Translatable | Tests |
|------|------------|----------:|-------------:|-------|
| AutoYaST issues (incl. `NoDisk`) | `storage` | 18 | 18 | `test/agama/storage/autoyast_translations_test.rb`, `test/translations/issues_test.rb` |
| Probing issues | `storage` | 3 | 3 | `test/translations/issues_test.rb` |
| Device descriptions | `storage` | 32 | 32 | `test/translations/devices_description_test.rb` |
| Encryption method labels | `storage` | 8 | 8 | `test/translations/devices_test.rb` |
| Resize (shrinking) reasons | `storage` | 15 | 15 | `test/translations/devices_test.rb` |
| Bootloader errors | `bootloader` | 20 | 6 | `test/translations/bootloader_test.rb` |
| AutoYaST profile fetching (CLI only, not the D-Bus service) | `installation` | 12 | 12 | `test/translations/callbacks_test.rb` |
| YaST base modules | `base`, `autoinst` | 0 | - | - |

Counts are distinct msgids. Every other `_()` / `N_()` in `service/YaST2/` is either never
loaded, only logged, only used in UI code, or has no caller in Agama (see "Not reachable").

In this environment `/usr/share/YaST2/locale` does not exist, so `_()` returns the English msgid.
The tests therefore check that the text is returned (English), not that it is translated.

## How strings reach D-Bus

| Channel | Code |
|---------|------|
| `Issues` property, `description` | `lib/agama/dbus/storage/manager.rb:75,327,467` -> `lib/agama/dbus/with_issues.rb:43` |
| `System` property, `issues[].description` and device `description` / `shrinking.reasons` | `lib/agama/dbus/storage/manager.rb:417-427,515` -> `devicegraph_conversions/to_json_conversions/{device,block}.rb` |
| D-Bus error message | an exception raised out of a D-Bus method (ruby-dbus sends `e.message`) |
| Question text / details | `lib/agama/storage/finisher.rb:221-234` (`exception.message` in the `details` of a question) |

## Reachable strings

### AutoYaST issues (`storage`)

Path: `Manager#configure` -> `Proposal#calculate_autoyast` -> `AutoinstProposal` adds the issue ->
`Manager#update_issues` -> `Autoyast#agama_issue` calls `ay_issue.message` (the string is
translated here) -> `Issues` property.

Only issue classes that are not warnings and that a planner really adds are reachable. Warning
classes are only logged by `Autoyast#log_warnings`.

| Text | File |
|------|------|
| Disk '%s' was not found | `YaST2/lib/y2storage/autoinst_issues/no_disk.rb:53` |
| No suitable disk was found | `no_disk.rb:55` |
| No root partition (/) was found. | `autoinst_issues/missing_root.rb:46` |
| Missing element '%{attr}' | `autoinst_issues/missing_value.rb:60` |
| Encryption method '%{crypt_method}' is not available in this system. | `autoinst_issues/invalid_encryption.rb:78` |
| '%{crypt_method}' is not a known encryption method. | `invalid_encryption.rb:85` |
| '%{crypt_method}' is not a suitable method to encrypt the device. | `invalid_encryption.rb:92` |
| The device '%{device}' cannot contain a partition table (%{type} requested). | `autoinst_issues/no_partitionable.rb:56` |
| Could not find a suitable device for Btrfs filesystem '%{name}'. | `autoinst_issues/no_components.rb:60` |
| Could not find a suitable physical volume for volume group '%{name}'. | `no_components.rb:65` |
| Could not find a suitable member for RAID '%{name}'. | `no_components.rb:70` |
| Could not find a backing device for Bcache '%{name}'. | `no_components.rb:75` |
| %{bcache_name}: only one %{role} can be specified per bcache. | `autoinst_issues/multiple_bcache_members.rb:69` |
| backing device (`N_`, used as `%{role}`) | `multiple_bcache_members.rb:37` |
| caching device (`N_`, used as `%{role}`) | `multiple_bcache_members.rb:38` |
| A drive of type '%{type}' is not supported in this architecture | `autoinst_issues/unsupported_drive_section.rb:49` |
| Thin pool '%s' was not found | `autoinst_issues/thin_pool_not_found.rb:51` |
| Could not find a reusable filesystem | `autoinst_issues/missing_reusable_filesystem.rb:53` |

Tests: `test/agama/storage/autoyast_translations_test.rb` (`NoDisk`, with the full backtrace
below) and `test/translations/issues_test.rb` (the others, one example each).

### Probing issues (`storage`)

Path: `Manager#probe` -> `Manager#probing_issues` (`lib/agama/storage/manager.rb:300-305`, uses
only `message` and `details`) -> `Manager#system_issues` -> `System` property.

| Text | File |
|------|------|
| The volume group %{name} is incomplete because some physical volumes are missing. | `YaST2/lib/y2storage/missing_lvm_pv_issue.rb:47` |
| The root filesystem looks like not currently mounted. | `YaST2/lib/y2storage/inactive_root_issue.rb:41` |
| Bcache detected, but bcache is not supported on this platform. | `YaST2/lib/y2storage/unsupported_bcache_issue.rb:38` |

Test: `test/translations/issues_test.rb`.

### Device descriptions (`storage`)

Path: `devicegraph_conversions/to_json_conversions/device.rb:75` ->
`Y2Storage::DeviceDescription#to_s` -> device JSON `description` (in `System` and `Proposal`).
All strings are in `YaST2/lib/y2storage/device_description.rb` (line in brackets) unless noted.

| Text | Text |
|------|------|
| Disk (:65, :66) | Multipath (:67) |
| BIOS RAID (:69) | RAID (:70) |
| LVM (:72) | Thin Pool (:74) |
| RAID LV (:75) | Cache LV (:76) |
| Cache Pool (:77) | Writecache LV (:78) |
| Mirror LV (:80) | LV (:81) |
| Xen (:82) | Partition (:83) |
| %{fs_type} %{device_label} (:152) | Encrypted %s (:364) |
| Encrypted %{fs_type} %{device_label} (:143) | Unused LVM PV (:198) |
| Unused encrypted LVM PV (:196) | PV of %s (:213) |
| Encrypted PV of %s (:209) | Snapshot of %{origin} (:239) |
| Encrypted Snapshot of %{origin} (:233) | %{fs_type} Journal (%{data_device_name}) (:266) |
| Part of %{fs_name} %{blk_device_name} (:291) | Part of encrypted %{fs_name} %{blk_device_name} (:283) |
| Backing of %{bcache} (:308) | Encrypted backing of %{bcache} (:305) |
| Bcache caching (:317) | Part of %s (:329) |
| Encrypted part of %s (:327) | (%{basename}...) (`filesystems/blk_filesystem.rb:143`) |

Test: `test/translations/devices_description_test.rb` (32 examples; fixtures and expected
descriptions are in the test).

### Encryption method labels (`storage`)

Path: the Agama config checker uses `method.to_human_string` in issue descriptions
(`config_checkers/encryption.rb:80,96,113`) -> `Issues` property.

| Text | File |
|------|------|
| Regular LUKS1 | `YaST2/lib/y2storage/encryption_method/luks1.rb:30` |
| Regular LUKS2 | `encryption_method/luks2.rb:36` |
| Pervasive Volume Encryption | `encryption_method/pervasive_luks2.rb:43` |
| TPM-Based Full Disk Encrytion | `encryption_method/tpm_fde.rb:44` |
| BLS Compliant Encryption With TPM Unlocking | `encryption_method/tpm_bls.rb:38` |
| Encryption with Volatile Random Key | `encryption_method/random_swap.rb:31` |
| Encryption with Volatile Protected Key | `encryption_method/protected_swap.rb:37` |
| Encryption with Volatile Secure Key | `encryption_method/secure_swap.rb:38` |

Test: `test/translations/devices_test.rb`.

### Resize (shrinking) reasons (`storage`)

Path: `to_json_conversions/block.rb:100` -> `Agama::Storage::DeviceShrinking#unsupported_reasons`
-> `ResizeInfo#reason_text` -> device JSON `shrinking.reasons`. All in
`YaST2/lib/y2storage/resize_info.rb`.

| Text | Line |
|------|-----:|
| Resizing is not supported by this device. | 41 |
| Combined limitations of partition and filesystem prevent resizing. | 42 |
| This filesystem does not support shrinking. | 43 |
| This multi-device filesystem does not support shrinking. | 44 |
| Filesystem consistency check failed. | 46 |
| This filesystem already has the minimum possible size. | 47 |
| The filesystem is full. | 49 |
| This partition already has the minimum possible size. | 51 |
| Extended partitions cannot be resized. | 52 |
| The partition on an implicit partition table cannot be resized. | 53 |
| Shrinking of this type of LVM logical volumes is not supported. | 54 |
| Resizing of this type of LVM logical volumes is not supported. | 55 |
| Resizing not supported since the logical volume has snapshots. | 56 |
| The LVM logical volume already has the minimum possible size. | 58 |
| The encryption password is required. | 60 |

Test: `test/translations/devices_test.rb`.

### Bootloader errors (`bootloader`)

Path A (`Finish`): `Finisher#run` -> `install_bootloader` -> `Bootloader::FinishClient#write` ->
exception -> `Finisher#ask_user` puts `exception.message` into the `details` of the
`bootloaderInstallError` question (`finisher.rb:187,217-234`).

Path B (`Install`, `SetConfig`, `Probe`, `Activate`): `BootloaderManager#configure` ->
`Grub2#propose` -> exception escaping the D-Bus method (D-Bus error message).

Translatable (the object called `textdomain "bootloader"` before `_()`):

| Text | File | Output |
|------|------|--------|
| Failed to configure reipl: | `YaST2/lib/bootloader/finish_client.rb:102` | question details |
| Failed to set default GRUB2 boot entry: | `bootloader/sections.rb:55` | question details |
| File /etc/default/grub missing on system | `bootloader/grub2base.rb:95` | question details |
| Error reading the bootloader configuration files. Please use YaST2 bootloader to fix it. Details: %s | `bootloader/exceptions.rb:82` | question details, D-Bus error |
| Error reading the bootloader configuration files:\nInvalid device name %s ... | `bootloader/exceptions.rb:98` | question details |
| Unknown udev device '%s' | `bootloader/udev_mapping.rb:73` | D-Bus error |

Reachable but **never translated** (the text is returned in English whatever the locale):

| Text | File | Why |
|------|------|-----|
| Installing GRUB2 failed. | `bootloader/exceptions.rb:36` | `_()` runs inside `super(...)`, before the exception sets its textdomain |
| Generating GRUB2 configuration failed. | `exceptions.rb:43` | same |
| Regenerating initrd with dracut failed. | `exceptions.rb:50` | same |
| Cannot create boot menu entry: | `bootloader/bls.rb:27` | `Bls` class methods, `textdomain` is only called on instances |
| Cannot install bootloader: | `bls.rb:33` | same |
| Cannot update bootloader: | `bls.rb:39` | same |
| Cannot write boot menu timeout: | `bls.rb:45` | same |
| Cannot read boot menu timeout: | `bls.rb:51` | same |
| Cannot write default boot menu entry: | `bls.rb:60` | same |
| Cannot read default menu: | `bls.rb:68` | same |
| Cannot enroll authentication: | `bls.rb:99` | same |
| Cannot create machine-id: | `bls.rb:110` | same |
| Cannot pass an empty password via the keyring. | `bls.rb:115` | same |
| Cannot pass the password via the keyring: | `bls.rb:122` | same |

Test: `test/translations/bootloader_test.rb` (helpers in `bootloader_helpers.rb`). It records
whether `textdomain "bootloader"` was set on the receiver of each `_()` call.

### AutoYaST profile fetching: CLI only (`installation`)

These strings are **not** returned by the D-Bus service. They reach the user as the text of an
`autoyastPopup` question that the separate `bin/agama-autoyast` process posts to the questions
API (`lib/agama/autoyast/report_patching.rb`). All are in
`YaST2/lib/transfer/file_from_url.rb`.

| Text | Line |
|------|-----:|
| Cannot find URL '%1' via protocol HTTP(S). Server returned code %2. | 221 |
| Cannot find URL '%1' via protocol FTP. Server returned code %2. | 241 |
| Reading file on %1/%2 failed.\n | 255 |
| Reading file on %1 failed.\n | 269 |
| Mounting %1 failed. | 314, 365, 409 |
| Reading a file on CD failed. Path: %1/%2. | 339 |
| Remote file %1 cannot be retrieved | 388, 432 |
| URLs starting with 'floppy:/' are not longer supported | 443 |
| %1 is not mounted and mount failed | 532 |
| File %1 cannot be found | 552 |
| Cannot find URL '%1' via protocol TFTP. | 574 |
| Unknown protocol %1. | 581 |

Test: `test/translations/callbacks_test.rb`.

The same CLI also loads `autoinstall/script_runner.rb`, `autoinstall/xml_checks.rb`,
`modules/{Profile,ProfileLocation,AutoInstallRules,AutoinstScripts}.rb` and
`AutoinstConfig#ParseCmdLine`. Their strings (textdomain `autoinst`) reach the same question
through `Report.*` and `Popup.show`, but there is no test for them.

## Not reachable

These strings exist in `service/YaST2/` but cannot reach the D-Bus service output.

| Where | Why |
|-------|-----|
| `autoinst_issues/*` with warning severity (`conflicting_attrs`, `could_not_calculate_boot`, `could_not_create_boot`, `invalid_value`, `missing_btrfs_quotas`, `missing_reusable_device`, `missing_reuse_info`, `shrinked_planned_devices`, `surplus_partitions`) | Only logged by `Autoyast#log_warnings` |
| `autoinst_issues/{exception,no_disk_space,no_proposal}.rb`, `no_partitionable.rb:62` | Never instantiated or a dead branch |
| `boot_requirements_strategies/*`, `setup_checker.rb` | Only `SetupChecker` uses them, and Agama never calls it |
| `description` / `details` of the Y2Storage probing issues | Agama copies only `message` and `details`, and `details` is nil |
| `y2issues/invalid_value.rb` | Never loaded |
| `y2storage/callbacks/activate.rb`, `dialogs/callbacks/activate_luks.rb` | Agama has its own callbacks (`lib/agama/storage/callbacks/`) |
| `y2storage/callbacks/initialize.rb` | UI popup on `Storage::LockException` |
| `to_human_string` of the enums `md_level`, `md_parity`, `btrfs_raid_level`, `cache_mode`, `encryption_type`, `pbkd_function`, `mount_by_type`, `encryption_authentication` | Agama sends the symbol name, never the human string |
| `nfs_version.rb` | `NfsVersion#name` never calls `_()`, so it is never translated |
| Other `device_description.rb` labels (`Bcache`, `NFS`, `PV`, `Thin LV`, `Snapshot LV`, `Btrfs Subvolume`, thin snapshots, `Encrypted PV of LVM`, ...) | The device types are not serialized |
| `bcache_cset.rb`, `lvm_pv.rb`, `tmpfs.rb`, `actions_presenter.rb`, `settings_adjustment.rb`, `encrypt_password_checker.rb`, other `blk_filesystem.rb` names | No caller in Agama |
| Unused `resize_info.rb` reasons (growing, maximum size, read-only, ...) | `DeviceShrinking` never asks for them |
| `bootloader/*` `summary` methods, `cpu_mitigations.rb`, `modules/Bootloader.rb` | Never called, or log only |
| `Label`, `Popup`, `String`, `Report`, `ProductControl`, `ModuleLoading`, `Icon`, `Initrd`, `Kernel`, `OSRelease`, `InstExtensionImage`, `ServicesManagerTarget`, `lib/yast2/*` | UI helpers with no caller. `Report` and `Popup` raise an untranslated error in this service, see below |
| `y2network/startmodes/*`, `wireless_*`, `ui/*`, `iscsi-client` strings, finish client titles, `cio_ignore.rb`, `umount_finish.rb` | Agama uses only the names or ids, passes `silent: true`, or never calls the methods that translate |

## Other findings

- `Yast::I18n#_` uses a **per-object** textdomain (`@my_textdomain`). If the object never called
  `textdomain`, `_()` returns the msgid untranslated. This is why 14 bootloader strings above are
  never translated. It also corrects what I wrote earlier about `Agama::Storage::Manager` and
  `Agama::Storage::Zfcp::Manager` (both use `_()`, domain `agama`):
  - `Storage::Manager` gets its domain only after `locale=` runs
    (`lib/agama/storage/manager.rb:199` -> `WithLocale#change_process_locale`).
  - `Storage::Zfcp::Manager` never calls `textdomain` and does not include `WithLocale`, so its
    three messages ("The zFCP controller %s cannot be activated", ...) are never translated.
- `Yast::Report.*`, `Yast2::Popup.show` and non-bang `Yast2::Execute` calls raise an untranslated
  `RuntimeError "Failed to open dialog, see logs."` in the service, before the message is stored.
  That text can become a D-Bus error. It is not a marked string.
- `YaST2/lib/y2storage/device_description.rb:109`: `format(_("Encrypted %s"))` has no argument.
  It is unreachable today, but it would raise `ArgumentError`.
- `encryption_method/*`: the labels are translated once when the constants are created at load
  time, and again in `to_human_string`. This only works because the first call is a no-op under
  an English startup locale.
- The original claim that all 22 `autoinst_issues` classes are reached the same way was too
  broad. Only the ones in the table above are.

## Call path example: `NoDisk`

Run `TRACE_TRANSLATIONS=1 bundle exec rspec -O /dev/null
test/agama/storage/autoyast_translations_test.rb` to print the backtraces.

The issue is created (no translation yet):

```
YaST2/lib/installation/autoinst_issues/list.rb:73                 List#add
YaST2/lib/y2storage/proposal/autoinst_drives_map.rb:152           AutoinstDrivesMap#add_disks
YaST2/lib/y2storage/proposal/autoinst_drives_map.rb:59            AutoinstDrivesMap#initialize
YaST2/lib/y2storage/autoinst_proposal.rb:76                       AutoinstProposal#calculate_proposal
YaST2/lib/y2storage/proposal/base.rb:91                           Proposal::Base#propose
lib/agama/storage/proposal_strategies/autoyast.rb:63              Autoyast#calculate
lib/agama/storage/proposal.rb:326                                 Proposal#calculate
lib/agama/storage/proposal.rb:201                                 Proposal#calculate_autoyast
lib/agama/storage/proposal.rb:166                                 Proposal#calculate_from_json
lib/agama/storage/configurator.rb:45                              Configurator#configure
```

The string is translated when the Agama issue is built (`NoDisk#message`):

```
lib/agama/storage/proposal_strategies/autoyast.rb:113             Autoyast#agama_issue
lib/agama/storage/proposal_strategies/autoyast.rb:71              Autoyast#issues
lib/agama/storage/proposal.rb:231                                 Proposal#issues
lib/agama/storage/manager.rb:294                                  Manager#update_issues
lib/agama/storage/manager.rb:133                                  Manager#configure
```

`Proposal#success?` does not evaluate `issues` when the proposal already failed, so
`Manager#update_issues` is the first caller. The string is translated lazily, with the locale
active at that moment.

## Tests

All tests live in `service/test/translations/` and `service/test/agama/storage/`. The default
`.rspec` pattern loads the whole suite, so run them with `-O /dev/null`:

```
bundle exec rspec -O /dev/null test/translations/*_test.rb \
  test/agama/storage/autoyast_translations_test.rb
```

113 examples: issues 19 + 3 `NoDisk`, devices 55, bootloader 21, callbacks 15. The tests need
`libstorage-ng-ruby` >= 4.5.369.

## Textdomain `agama` (for reference)

`service/lib/` has its own strings in the `agama` domain: progress steps in
`lib/agama/dbus/storage/manager.rb` and issues built with `Issue.new(_("..."))` in
`lib/agama/storage/` (`proposal.rb`, `manager.rb`, `config_checkers/`). See the note on
`Storage::Manager` and `Storage::Zfcp::Manager` above.
