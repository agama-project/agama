# Packaging

D-Installer packages are available in the [YaST:Head:D-Installer project in
OBS](https://build.opensuse.org/project/show/YaST:Head:D-Installer). This document summarizes the
process we follow to build those packages.

## Update release information

Before releasing a new version, you are expected to update the version and the changelogs
and commit those changes to the repository.

* `VERSION` contains the version number for the Ruby packages (the service and the CLI). This value
  is read and injected in the corresponding `gemspec` files when building the Ruby gems. Do not
  forget to run `bundle` to update the version in the `Gemfile.lock` file.
* `web/package/_service` defines the configuration of the build service. The version
  number is specified as a param of the `set_version` service.
* The changes files are included in the corresponding `package` directories.

## Building the packages

After updating the releasing information and commiting those changes to the repository, it is time
to update the packages in the build service.

### Service and CLI

The process to release new version of the service and the CLI is pretty much the same. You can check
the current packages in
[YaST:Head:D-Installer/rubygem-d-installer](https://build.opensuse.org/package/show/YaST:Head:D-Installer/rubygem-d-installer)
and
[YaST:Head:D-Installer/rubygem-d-installer-cli](https://build.opensuse.org/package/show/YaST:Head:D-Installer/rubygem-d-installer-cli).

Given that you are in the `service` or the `cli` directories, the process to release a new version
can be summarized in these steps:

1. Build the `gem` by running `gem build d-installer.gemspec` or `gem build
   d-installer-cli.gemspec`.
2. Update the `spec` file using the `gem2rpm` tool. The configuration is [included in the
   repository](./service/package/gem2rpm.yml). To regenerate the spec, you might type something
   like:

       gem2rpm --config package/gem2rpm.yml d-installer-0.1.gem > package/rubygem-d-installer.spec

3. Checkout the OBS package and copy the `gem`, the `spec` and the `changes` files from the
   repository.
4. Commit the changes.

### The Cockpit module

The current package is
[YaST:Head:D-Installer/cockpit-d-installer](https://build.opensuse.org/package/show/YaST:Head:D-Installer/cockpit-d-installer).
You can figure out most details by checking the [_service](_./web/package/_service) file. It might
happen that you get out of RAM when building the package, so in this case, it is better to build it
remotely.

Given that you are in the `web` directory, the process to update the package is:

1. Checkout the OBS package and copy `package/*` and `package-lock.json` files from the repository.
2. In your package checkout, run `osc service manualrun`. It will update D-Installer sources and
   dependencies (`node_modules`).
3. Commit the changes.

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
