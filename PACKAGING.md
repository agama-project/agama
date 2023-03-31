# Packaging

Agama packages are available in the [YaST:Head:Agama project in
OBS](https://build.opensuse.org/project/show/YaST:Head:Agama). This document summarizes the
process we follow to build those packages.

The process to build each package is slightly different depending on the technology we are using.
While the Ruby-based one (`rubygem-agama`) is built as any other YaST package, the web UI
(`cockpit-agama`) and the CLI (`agama-cli`) rely on [OBS source
services](https://openbuildservice.org/help/manuals/obs-user-guide/cha.obs.source_service.html).

## Versioning policy

We have decided to follow a single number schema: 1, 2, 3, etc. However, if we need to release a
hot-fix, we might use a dotted version (e.g., 2.1). Moreover, all the components share the same
version number. Releasing a new version implies that all of them get the new number, no matter if
they contain changes or not.

## Bumping the version

In order to release a new version, we need to:

1. Update the version number in the `service/VERSION` file with the new number. These file is read
  when building the `rubygem-agama` package.
2. `(cd service; bundle install)` # Updates Gemfile.lock which is part of the repository
3. Add entries in the changes files.
    `osc vc service/package`
    `osc vc rust/package`
    `osc vc web/package`
4. Open a pull request to get these changes into the repository.
5. Once the pull request is merged, tag the repository with the proper version number. The processes
   to build `cockpit-agama` and `agama-cli` use this information to infer the version. You can set
   the tag with something like:

      git tag --sign v$(cat service/VERSION) --message "Version $(cat service/VERSION)"
      git push --tags


## Building the packages

### Service

You can check the current package in
[YaST:Head:Agama/rubygem-agama](https://build.opensuse.org/package/show/YaST:Head:Agama/rubygem-agama).

Use `rake` to update the package in OBS as you would do with any other YaST package:

      cd service
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
[YaST:Head:Agama](https://build.opensuse.org/package/show/YaST:Head:Agama/agama-cli). To update the
package in the build service, run the following commands:

      osc service manualrun
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
