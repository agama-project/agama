## Multi-Process Backend

The idea is to have a backend consisting of several services that communicate
via D-Bus. The goals of such an approach are:

* Parallelize as much work as possible, especially relevant during probing.
* Keep service responsiveness even when a long-running task is running.
* Improve reusability by building smaller D-Bus-based services.

## Processes or threads

We decided to go for processes instead of threads because the latter are known
to cause problems to YaST and it is easier to avoid race conditions. Moreover,
we could even reimplement any of those services in a different language in the
future.

## Proof-of-concept

Untangling the YaST code into different processes is quite a challenging task.
Take the *storage* API as an example: other components, like *bootloader*, use
its API extensively. Hence we decided to extract the *users handling* part in
the first place. Of course, in terms of speed and responsiveness, it does not
bring much benefit, but we thought it was a good starting point because:

1. Users handling was (partially) refactored recently, so it is well covered
   by unit tests.
2. No other D-Installer component relies on users handling.

### Users

We found these dependencies:

- `MailAliases` (which depends on `MailTable`): no other D-Installer component
  depends on it.
- `ShadowConfig` uses CFA to modify the `login.defs` file, which is also used
  by `Security`. However, it looks like `Security` is not used in other parts
  of D-installer.
- `Autologin`, which uses many modules, including packages, can be tricky. It
  basically checks which supported Display Managers are available.
- `ProductFeatures`, which should be replaced with D-Installer configuration
  mechanism. Ignored by now.

We reached these agreements:

- This PoC uses a special directory (`service/lib/dinstaller/dbus/y2dir`)
  which contains a modified version of the dependencies. This directory is
  added to `Y2DIR`, so these modules are used instead of the original ones.
- Having `DInstaller::DBus::Clients` for D-Bus clients that are needed to
  communicate between different processes.

## Future steps

- We agreed on using a separate process for questions. The API should allow to
  asking questions and replying to them.
- Software is the most time-consuming aspect of the installation, so we should
  aim to move it to a separate process.
