# Packaging

Agama packages are available in the [YaST:Head:Agama project in
OBS](https://build.opensuse.org/project/show/YaST:Head:Agama). This document summarizes the
process we follow to build those packages.

The process to build the Ruby-based ones (`rubygem-agama` and `rubygem-agama-cli`) is
different from the one we use to build the web UI (`cockpit-agama`). The former packages are
built in the same way that other YaST packages (through Rake tasks), while the latter package is
automatically built in the Open Build Service.

## Releasing a new version

In order to release a new version, we need to:

* Update the version number in the `VERSION` file in the corresponding subdirectory. These files are
  read by the Ruby-based packages when building the gems.
* Tag the repository with the proper number. The process to build `cockpit-agama` uses this
  information to infer the version. You can set the tag with something like:

      git tag --sign 0.5 --message "Version 0.5"
      git push --tags

## Building the packages

After updating the releasing information and commiting those changes to the repository, it is time
to update the packages in the build service.

### Service

You can check the current package in
[YaST:Head:Agama/rubygem-agama](https://build.opensuse.org/package/show/YaST:Head:Agama/rubygem-agama).

Given that you are in the `service` directory, just type the following command to update the
package in the build service:

      rake osc:commit

If you just want to build the package locally, run:

      rake osc:build

### The Cockpit module

The current package is
[YaST:Head:Agama/cockpit-agama](https://build.opensuse.org/package/show/YaST:Head:Agama/cockpit-agama).
It relies on [OBS Source
Services](https://openbuildservice.org/help/manuals/obs-user-guide/cha.obs.source_service.html) to
fetch the sources (including the dependencies), set the version and build the package. You can
figure out most details by checking the [_service](_./web/package/_service) file. 

To update the package in the build service, you just need to type:

      osc service manualrun
      osc commit -m "Update sources"

If you want to build the package locally, just checkout (or branch) the package and run `osc build`.

The version number is inferred from the repository tags (see [Releasing a new
version](#releasing-a-new-version)): it uses the latest tag and the offset of the latest commit
respect such a tag. (e.g., `0.1~2`).

You can read more about the overall approach of this package in the following article: [Git work
flows in the upcoming 2.7 release](https://openbuildservice.org/2016/04/08/new_git_in_27/).

### Command-line interface

The current package is
[YaST:Head:Agama](https://build.opensuse.org/package/show/YaST:Head:Agama/agama-cli).
Bear in mind that the sources are in a [different
repository](https://github.com/yast/agama-cli). To update the package in the build service,
run the following commands:

      osc service runall
      osc addremove *
      osc commit -m "Update sources"

If you want to build the package locally, just checkout (or branch) the package and run `osc build`.

The version number is inferred from the repository tags (see [Releasing a new
version](#releasing-a-new-version)): it uses the latest tag and the offset of the latest commit
respect such a tag. (e.g., `0.1~2`).

### The Live ISO

The ISO is built and developed in
[YaST:Head:Agama/agama-live](https://build.opensuse.org/package/show/YaST:Head:Agama/agama-live).
See [IMAGE.md](./IMAGE.md) for more details.
