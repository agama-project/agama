# Packaging

D-Installer packages are available in the [YaST:Head:D-Installer project in
OBS](https://build.opensuse.org/project/show/YaST:Head:D-Installer). This document summarizes the
process we follow to build those packages.

The process to build the Ruby-based ones (`rubygem-d-installer` and `rubygem-d-installer-cli`) is
different from the one we use to build the web UI (`cockpit-d-installer`). The former packages are
built in the same way that other YaST packages (through Rake tasks), while the latter package is
automatically built in the Open Build Service.

## Releasing a new version

In order to release a new version, we need to:

* Update the version number in the `VERSION` file. This file is read by the Ruby-based packages
  when building the gems.
* Tag the repository with the proper number. The process to build `cockpit-d-installer` uses this
  information to infer the version. You can set the tag with something like:

      git tag --sign 0.5 --message "Version 0.5"
      git push --tags

## Building the packages

After updating the releasing information and commiting those changes to the repository, it is time
to update the packages in the build service.

### Service and CLI

You can check the current packages in
[YaST:Head:D-Installer/rubygem-d-installer](https://build.opensuse.org/package/show/YaST:Head:D-Installer/rubygem-d-installer)
and
[YaST:Head:D-Installer/rubygem-d-installer-cli](https://build.opensuse.org/package/show/YaST:Head:D-Installer/rubygem-d-installer-cli).

Given that you are in the `service` or the `cli` directory, just type the following command to
update the packages in the build service:

      rake osc:commit

If you just want to build the package locally, run:

      rake osc:build

### The Cockpit module

The current package is
[YaST:Head:D-Installer/cockpit-d-installer](https://build.opensuse.org/package/show/YaST:Head:D-Installer/cockpit-d-installer).
It relies on [OBS Source
Services](https://openbuildservice.org/help/manuals/obs-user-guide/cha.obs.source_service.html) to
fetch the sources (including the dependencies), set the version and build the package. You can
figure out most details by checking the [_service](_./web/package/_service) file. 

To update the package in the build service, you just need to type:

      osc rebuild YaST:Head:D-Installer cockpit-d-installer

If you want to build the pacakge locally, just checkout (or branch) the package and run `osc build`.

The version number is inferred from the repository tags (see [Releasing a new
version](#releasing-a-new-version)): it uses the latest tag and the abbreviated hash of the last
commit (e.g., `0.5.49e6a2a`).

You can read more about the overall approach of this package in the following article: [Git work
flows in the upcoming 2.7 release](https://openbuildservice.org/2016/04/08/new_git_in_27/).

### The Live ISO

The ISO is built in
[YaST:Head:D-Installer/d-installer-live](https://build.opensuse.org/package/show/YaST:Head:D-Installer/d-installer-live).
Once a package is rebuilt, the ISO image gets refreshed too. If you want to release
a new version, follow these steps:

1. Bump the version in the `preferences` section of the [kiwi](./image/d-installer-live.kiwi) file
   through a pull request.
2. Once the pull request is merged, checkout (or branch) the OBS package.
3. Run `osc service manualrun` in your checkout to update the sources.
4. Commit the changes.

See [image/README.md](./image/README.md) for more details about how the Live ISO is built.
