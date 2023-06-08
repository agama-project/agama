# The Open Build Service (OBS) Integration

The Agama installer packages are built in the openSUSE [Open Build Service](
https://build.opensuse.org/).

## Staging Project

The [systemsmanagement:Agama:Staging](https://build.opensuse.org/project/show/systemsmanagement:Agama:Staging)
contains the latest packages built from the `master` Git branch. This project
contains unstable development version of Agama. It is intended for development
and testing.

The packages are automatically updated whenever the `master` branch is changed,
see more details below.

## Development Project

The [systemsmanagement:Agama:Devel](https://build.opensuse.org/project/show/systemsmanagement:Agama:Devel)
contains the latest released version of the Agama project. The packages should
be more stable than in the Staging project.

These packages are updated manually when a new version is released.

## OBS Synchronization

The automatic OBS synchronization is implemented using the [GitHub Actions](
https://github.com/features/actions). The actions are defined in the
`obs-staging-*.yml` files in the [.github/workflows](../.github/workflows)
directory.

Because the process of updating a package is the same for several packages
the definition is shared in the [obs-staging-shared.yml](
../.github/workflows/obs-staging-shared.yml) file.

The packages in staging are updated only when a respective source file is
changed. That saves some resources for rebuilding and makes synchronization
faster. But that also means the packages might not have exactly same version.

### Details

The packages in OBS are updated by running the OBS service which downloads the
sources from GitHub and dependencies from other repositories (Rust or NPM
packages).

The process of updating a package is basically:

- `osc co systemsmanagement:Agama:Staging <package>` - checkout the package
  from OBS
- `osc service manualrun` - update the sources and dependencies by running
  the OBS services locally
- `osc commit` - upload the changes to the OBS server, it will rebuild the
  updated package automatically

To run the services locally you need to install the OSC tool and several
packages with the used OBS services:

```shell
zypper install osc obs-service-cargo_audit obs-service-cargo_vendor \
  obs-service-download_files obs-service-format_spec_file obs-service-obs_scm \
  obs-service-node_modules
```

The `rubygem-agama` package uses a different approach because the Ruby packages
use `*.gem` files which are not supported by OBS services. It uses the
[osc:commit](https://github.com/openSUSE/packaging_rake_tasks#osccommit) Rake
task, same as the YaST packages.

### Package Versioning

### Staging

The packages in the Staging project use a version built from the last released
version with a number of commits in the `master` branch since that release.

The version is automatically constructed by the OBS service, for the
`rubygem-agama` package the version is built using the `git describe --tags`
command.

### Devel

The Devel packages use the release version (a Git tag) without any additional
number of commits.
