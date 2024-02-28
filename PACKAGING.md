# Packaging

This document summarizes the process we follow to build the Agama packages.

The Agama packages are available in two OBS projects:

- [systemsmanagement:Agama:Staging](
  https://build.opensuse.org/project/show/systemsmanagement:Agama:Staging) -
  contains the latest packages built from the `master` branch in Git. This
  project contains unstable development version of Agama. It is intended for
  development or testing new unfinished features.

  These packages are automatically updated whenever the master branch is changed.

- [systemsmanagement:Agama:Devel](
  https://build.opensuse.org/project/show/systemsmanagement:Agama:Devel) -
  contains the latest released version of the Agama project. These packages
  should be more stable than in the Staging project. It is intended for testing.

  These packages are updated automatically when a new version is released. See
  more detail in the [bumping the version](#bumping-the-version) section below.

You can find more details the automatic OBS synchronization in the
[obs_integration.md](doc/obs_integration.md) file.

The process to build each package is slightly different depending on the
technology we are using. While the Ruby-based one (`rubygem-agama-yast`) is
built as any other YaST package, Agama server (`agama`), the CLI (`agama-cli`),
and the web UI (`cockpit-agama`) rely on
[OBS source services](https://openbuildservice.org/help/manuals/obs-user-guide/cha.obs.source_service.html).

## Versioning Policy

We have decided to follow a single number schema: 1, 2, 3, etc. However, if we need to release a
hot-fix, we might use a dotted version (e.g., 2.1). Moreover, all the components share the same
version number. Releasing a new version implies that all of them get the new number, no matter if
they contain changes or not.

## Bumping the Version

In order to release a new version, we need to:

1. `(cd service; bundle install)` # Updates Gemfile.lock which is part of the repository
2. Add entries in the changes files.
    `osc vc service/package`
    `osc vc rust/package`
    `osc vc web/package`
3. Open a pull request to get these changes into the repository.
4. Once the pull request is merged, tag the repository with the proper version number. The processes
   to build the packages use this information to infer the version. You can set
   the tag with the `rake tag` command.

   ```shell
   # automatic version, use the current <major version> + 1
   rake tag
   # manual version, useful for releasing a hot fix with a minor version
   rake tag[42.1]
   ```

   You need to push the tag to the server manually, see the `rake tag` output.

After creating the tag on the server the GitHub Actions will publish the
packages in the [systemsmanagement:Agama:Devel](
https://build.opensuse.org/project/show/systemsmanagement:Agama:Devel)
project and create submit requests to openSUSE Factory.

## Building the Packages

The packages are updated automatically using the GitHub actions. Here are details
for manual update.

### Service

You can check the current package in
[systemsmanagement:Agama:Staging/rubygem-agama-yast](
https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/rubygem-agama-yast).

Use `rake` to update the package in OBS as you would do with any other YaST package:

      cd service
      rake osc:commit

If you just want to build the package locally, run:

      rake osc:build

### The Cockpit Module

The current package is [systemsmanagement:Agama:Staging/cockpit-agama](
https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/cockpit-agama).

It relies on [OBS Source
Services](https://openbuildservice.org/help/manuals/obs-user-guide/cha.obs.source_service.html) to
fetch the sources (including the dependencies), set the version and build the package. You can
figure out most details by checking the [_service](web/package/_service) file.

To manually update the package in the build service, you just need to type:

      sudo zypper install obs-service-node_modules
      osc service manualrun
      osc commit -m "Update sources"

If you want to build the package locally, just checkout (or branch) the package and run `osc build`.

The version number is inferred from the repository tags (see [Releasing a new
version](#releasing-a-new-version)): it uses the latest tag and the offset of the latest commit
respect such a tag. (e.g. `2.1+42`).

You can read more about the overall approach of this package in the following article: [Git work
flows in the upcoming 2.7 release](https://openbuildservice.org/2016/04/08/new_git_in_27/).

### Server and Command-line Interface

The current package is [systemsmanagement:Agama:Staging/agama](
https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/agama),
which includes `agama` and `agama-cli` as a subpackage.

To manually update the package in the build service, run the following commands:

      sudo zypper install obs-service-cargo_vendor obs-service-cargo_audit   # from Factory or devel:languages:rust
      osc service manualrun
      osc addremove *
      osc commit -m "Update sources"

If you want to build the package locally, just checkout (or branch) the package and run `osc build`.

The version number is inferred from the repository tags (see [Releasing a new
version](#releasing-a-new-version)): it uses the latest tag and the offset of the latest commit
respect such a tag. (e.g. `2.1+42`).

### The Live ISO

The ISO is built and developed in [systemsmanagement:Agama:Staging/agama-live](
https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/agama-live).
See [IMAGE.md](./IMAGE.md) for more details.
