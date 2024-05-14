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

These packages are updated automatically when a new version is released. See
more details below.

## Releasing a New Version

For releasing a new version just create a new version tag. The process is then
fully automated. See more details in the [Packaging documentation](
../PACKAGING.md#bumping-the-version).

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

The project to which the packages are submitted is configured in the
`OBS_PROJECT` GitHub Actions variable.

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

### Synchronizing GitHub Fork with OBS Branch

It is possible to synchronize your GitHub fork with your OBS brach
automatically. This allows easily build your own updated packages or even the
Live ISO.

#### OBS Branch

First you need to create an OBS project where the packages will be built.

The easiest way is to branch the Agama package which you want to modify from the
[systemsmanagement:Agama:Staging](
https://build.opensuse.org/project/show/systemsmanagement:Agama:Staging)
repository. This will inherit the repository setup for building the packages,
images and containers.

``` shell
osc branch systemsmanagement:Agama:Staging agama-web-ui
```

This will create `home:$OBS_USER:branches:systemsmanagement:Agama:Staging`
project where `$OBS_USER` is your OBS account name. This `$OBS_USER` placeholder
is also used in the following text.

By default the project will build packages and ISO images for all architectures.
But if you want to test the packages on a single architecture then it is a good
idea to remove the other architectures and save some OBS build power.

To remove all architectures except the x86_64 run this command:

``` shell
osc meta prj home:$OBS_USER:branches:systemsmanagement:Agama:Staging | \
sed "/<arch>aarch64<\/arch>/d;/<arch>i586<\/arch>/d;/<arch>ppc64le<\/arch>/d;/<arch>s390x<\/arch>/d;" | \
osc meta prj -F - home:$OBS_USER:branches:systemsmanagement:Agama:Staging
```

The branched package is still linked to the original package. This might cause
conflicts after the original package is updated. To avoid this problem you
should detach the branched package from the original repository:

``` shell
osc detachbranch home:$OBS_USER:branches:systemsmanagement:Agama:Staging agama-web-ui
```

If you want to also build the Live ISO from your modified packaged then you need
to branch (and detach) also the `agama-live` package:

``` shell
osc branch systemsmanagement:Agama:Staging agama-live
osc detachbranch home:$OBS_USER:branches:systemsmanagement:Agama:Staging agama-live
```

*Please delete your branched OBS project once you do not need it anymore, it
will save quite some OBS build power.*

#### GitHub Fork

Then you can fork the [Agama](https://github.com/openSUSE/agama) repository at
GitHub.

When creating a fork GitHub by default copies only the `master` branch. It does
not copy the other branches nor tags. The code supports this option, just be
prepared that the package versions might be different than in the original Agama
OBS repository because the tags are used to get the version number. If tags are
missing the version will be set to the commit Unix time stamp followed by a
short commit hash.

If you want to have similar versions as the original packages then create a full
fork including all branches and tags (unselect the "Copy the master branch only"
option).

#### Configuring the GitHub Actions

The GitHub Actions needs some configuration to allow the automatic submission.

1. Go to the Settings -> Secrets and variables -> Actions -> New Repository
   Secret option in your Agama GitHub fork. Create two secrets with names
   `OBS_USER` and `OBS_PASSWORD` and set them to your OBS credentials.

   Tip: If you do not want to put your credentials for your main OBS account
   to GitHub then you might create a new separate testing OBS account.

2. Switch to "Variables" tabs and click "New Repository Variable".
   Create `OBS_PROJECT` variable with name of your OBS branch project
   ("home:$OBS_USER:branches:systemsmanagement:Agama:Staging"). If the variable
   is not created or is empty the autosubmission is disabled.

3. Enable the GitHub Actions in the "Actions" tab.

#### Triggering the Rebuild

*The autosubmission only works in the `master` branch in your fork, not in any
other branch!*

To trigger an update and rebuild of your package with the new sources just push
a commit to the `master` branch.

Alternatively you can trigger the package submission manually. Go to the
"Action" tab in GitHub, select the respective "Submit" action in the left side
bar and in the main area click the "Run workflow" selector. Then in the popup
keep the default `master` branch and click the "Run workflow" button.

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
