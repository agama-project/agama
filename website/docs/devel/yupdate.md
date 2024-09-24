---
sidebar_position: 8
---

# Patching Agama Live ISO

The Agama installer allows patching itself directly from the GitHub sources or from your local Git
checkout using the [yupdate
script](https://github.com/yast/yast-installation/blob/master/bin/yupdate). See more details in the
[yupdate documentation](https://github.com/yast/yast-installation/blob/master/doc/yupdate.md).

This patching only works when running from a live medium. You can also patch the standard YaST
modules included in the installer if needed.

The goal is to provide an easy way for testing fixes or new features for the end users or testers.

:::warning
This guide does not cover patching the Rust code. Given the amount of disk space that the compiler
takes, you must build the binary on a different machine.
:::

## Patching from GitHub

```console
yupdate patch openSUSE/agama master
```

You can replace the `master` branch with any branch containing a fix or a new feature.

## Patching from a local Git checkout

First you need to run the `rake server` command in your Agama Git checkout.

Then run this command:

```console
yupdate patch 192.168.1.2:8000
```

Replace the IP address with the IP address of your machine running the `rake server` command. Port
8000 is the default port used, modify it if you use a different port number.

## Options

You can modify the update process with these environment variables:

- `DEBUG=1` - to find more about what is going behind process. If it fails in rake install see
  VERBOSE below.
- `VERBOSE` - makes visible all commands and its output when doing rake install. Useful to debug if
  yupdate failed.
- `NPM_CACHE=1` - The installed NPM packages will be saved to a local cache and will be reused in
  the next run. This can speed up the patching process if you need to patch the installer several
  times. On the other hand this increases the amount of needed RAM memory. The cache is stored in
  `$HOME/.cache/agama-devel/` directory, if you need to refresh the content of the cache then delete
  this directory.
- `NODE_ENV=development` - The web front-end will be built in the development mode. The files will
  not be minimized and additional `*.map` files will be generated. This helps with debugging in the
  browser, you can get the locations in the original source files.
- `YUPDATE_SKIP_FRONTEND=1` - Skip updating the web front-end. Use this option when you use the
  webpack development server for running the web front-end. In that case updating the web front-end
  does not make sense because it is running in a different server. This saves some time and disk/RAM
  space.
- `YUPDATE_SKIP_BACKEND=1` - Skip updating the D-Bus service back-end. This is similar to the
  previous option, use it when you do want to keep the D-Bus service unchanged.

## Notes

For compiling the Javascript code and SCSS files the yupdate installs several RPM and NPM packages.
Because the live medium is completely running in a RAM disk all downloaded files are stored in the
RAM memory.

That means the machine should have enough memory for this process. If there is not enough memory the
system becomes completely frozen and might not respond to any input event.

Currently the minimum for a safe operation is around 4GB RAM. If you use the `NPM_CACHE=1` option
then recommended minimum is around 5GB.

## Activating the changes

After patching the files the DBus service is restarted if any related file has been changed. That
means the configured settings will be lost.

To activate the changes in the web front-end you need to reload the page in the browser.

:::warning
_In the Firefox browser you need to use the `Ctrl+F5` combination for reloading the page,
this uses full reload ignoring the cache. Plain `F5` uses cached files and will not reflect the
update on the server!_
:::

In some special cases you might need to do some additional actions manually, the update script might
not handle all corner cases.

## Implementation details

The support is implemented in the main
[Rakefile](https://github.com/openSUSE/agama/blob/master/Rakefile) and in the
[.yupdate.pre](https://github.com/openSUSE/agama/blob/master/.yupdate.pre) and
[.yupdate.post](https://github.com/openSUSE/agama/blob/master/.yupdate.post) hook scripts.

- The `.yupdate.pre` script prepares the system for compiling and installing new Agama files.
- The `Rakefile` code builds and installs both back-end and front-end parts.
- The `.yupdate.pre` script activates the changes, it restarts the back-end if needed.
