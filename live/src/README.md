# Live ISO

This directory contains a set of files that are used to build the Agama Live ISO
image.

## Sources

The sources are maintained in the [Agama Git
repository](https://github.com/openSUSE/agama/tree/master/live) repository.

## Building the ISO

To build the ISO locally run the

```shell
osc build -M <build_flavor> images
```

command. See the [_multibuild](_multibuild) file for the list of configured
build flavors. To build for example the openSUSE flavor run this command:

```shell
osc build -M openSUSE images
```

Note: For building an ISO image you need a lot of free space at the `/var`
partition. Make sure there is at least 25GiB free space otherwise the build
might fail.

## Changes

Please *do not* change any file in the OBS repository. The files are
automatically uploaded from the [Agama Git
repository](https://github.com/openSUSE/agama/tree/master/live), your manual
changes will be lost at the next update.
