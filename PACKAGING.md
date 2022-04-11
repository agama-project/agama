# Packaging

D-Installer packages are available in the [YaST:Head:D-Installer project in
OBS](https://build.opensuse.org/project/show/YaST:Head:D-Installer). This document summarizes the
process we follow to build those packages.

## Service

You can check the current package in
[YaST:Head:D-Installer/rubygem-d-installer](https://build.opensuse.org/package/show/YaST:Head:D-Installer/rubygem-d-installer).
At this point, D-Installer has not been released as a Rubygem yet, so you need to do an extra step.

The process to release a new version can be summarized in these steps:

1. Bump the version in the `d-installer.gemspec` file.
2. Build the `gem` by running `gem build d-installer.gemspec`
3. Add an entry in the changes file.
4. Checkout the OBS package and copy the `gem` and the `changes` files.
5. Commit the changes.

If you need to modify the `spec` file, please, use the `gem2rpm` tool. The configuration is [included
in the repository](./service/package/gem2rpm.yml). To regenerate the spec, just type:

    gem2rpm --config gem2rpm.yml d-installer-0.1.gem > rubygem-d-installer.spec

## Cockpit module

The current package is
[YaST:Head:D-Installer/cockpit-d-installer](https://build.opensuse.org/package/show/YaST:Head:D-Installer/cockpit-d-installer).
You can figure out most details by checking the
[_service](_./web/package/_service) file. It might happen that you get
out of RAM when building the package, so in this case, it is better to
branch the package and try to build it remotely.

The process to update the package is:

1. Bump the version in the `package/_service` file.
2. Add an entry in the changes file.
3. Checkout the OBS package and copy `package/*` and `package-lock.json` files.
4. In your package checkout, run `osc service manualrun`. It will update D-Installer sources and its
   dependencies (`node_modules`).
5. Commit the changes.

You can read more about the overall approach of this package in the following article: [Git work
flows in the upcoming 2.7 release](https://openbuildservice.org/2016/04/08/new_git_in_27/).
