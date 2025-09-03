# Development script

This directory contains scripts useful for Agama development.

## Git autosubmission to OBS

The [branch2obs.sh](./branch2obs.sh) script creates an OBS project and configures the GitHub Actions
for automatic submission from the specified Git branch or the current branch. Each branch can be
submitted to a different OBS project.

There are several use cases for this script. You can use it for [building testing
images](#testing-builds) with patched Agama so the testers can easily test your fixes. Another use
case is using it for a long running feature or refactoring, especially when more people work on
that.

And last but not least, it can be used for preparing a new [version for release](#release-builds).
The release branch can be configured to be submitted to a special OBS release project while the
master continues in accepting new features for the future release and is submitted to the usual
development project.

### Used tools

The script requires the `git`, `gh`, `jq` and `osc` command line tools to be installed. The `osc`
and `gh` tools need to be configured/authenticated against OBS respective GitHub. Do not worry the
script checks for that.

### GitHub configuration

If you run the script in your GitHub fork then you need to configure the OBS credentials. When
running in the original repository it will use an already pre-configured OBS user, you do not need
to change anything.

You need to create the `OBS_USER` action variable containing your OBS login name. You can do that
from command line running command

    gh -R <gh_user>/agama variable set OBS_USER --body <obs_user>

where `gh_user` is your GitHub login name and `obs_user` your OBS login name.

Alternatively you can create the variable manually by visiting URL

    https://github.com/<gh_user>/agama/settings/variables/actions/new

where `gh_user` is your GitHub login name. On that page create variable `OBS_USER` with your OBS
login name.

Similarly we need to enter the OBS password, but as this is sensitive private value we use GitHub
secret for that. From command line run this command

    gh -R <gh_user>/agama secret set OBS_PASSWORD

where `gh_user` is your GitHub login name. The command will interactively ask for the password.

Or you can create the secret in browser going to this page

    https://github.com/<gh_user>/agama/settings/secrets/actions/new`

where `gh_user` is your GitHub login name. Create a new secret with name `OBS_PASSWORD` and
enter your OBS password as the value.

### Testing builds

This works in both original repository and in a fork.

- Create a new branch in git and push it to GitHub
- Run the `branch2obs.sh` script
- The Git branch name is by default used in the OBS project name
  - `systemsmanagement:Agama:branches:<branch_name>` for the original repository
  - `home:<your_name>:Agama:branches:<branch_name>` for forks

### Release builds

This works only in the original repository because is uses the
[systemsmanagement:Agama:Release](https://build.opensuse.org/project/show/systemsmanagement:Agama:Release)
project for submitting.

- Create a new release branch in git and push it to GitHub
  - `git checkout -b beta2`
  - `git push origin beta2`
- Configure submission, use the systemsmanagement:Agama:Release project as the target
  - `branch2obs.sh -p systemsmanagement:Agama:Release`
- Bump the version in master branch for the next release
  - `git checkout master`
  - Update the ISO version in `live/src/agama-installer.kiwi`, use the `pre` suffix to distinguish
    between a development version and the final version. I.e. for Beta3 change the version from `12`
    to `13pre`.
  - Push the changes
    - `git commit -a`
    - `git push`
  - Configure that the version tag is submitted to the Devel project as well:
    - `branch2obs.sh -b v13.pre -p systemsmanagement:Agama:Devel`
    - Important: The version tag needs to contain the dot separator between the version and "pre"
      suffix! It is used in the Agama Ruby gem version and Ruby Gemspec is quite picky about the
      version format.
  - Create the version tag and push it to GitHub
    - `git tag -s -m "Version v13.pre" v13.pre`
    - `git push origin v13.pre`
    - Important: The new version tag must not be reachable from the release branch otherwise it
      would use this version as well. That special version bump commit created before ensures that.
- Now the new features can be committed to the `master` branch without breaking the release code.
- Do not forget to merge the fixes from the release branch also to `master`.
- When the development for the next release is open in `master` remove the `pre` suffix from the
  version (use the same process as described above without the `pre` suffix).
- The "pre" tag can be removed from Git, it is not used anymore.
- You might remove the mapping for the previous release branch from the
  [OBS_PROJECTS](https://github.com/agama-project/agama/settings/variables/actions/OBS_PROJECTS)
  GitHub variable. Just to avoid accidentally updating the packages with the old
  code when a commit is added to the old branch.

## Cleanup

After deleting a branch in Git (either explicitly or automatically after merging a pull request) the
respective OBS project should be deleted.

That can be done by running `branch2obs.sh -c`, it scans the OBS subprojects and deletes the ones
which do not have a matching Git branch. It also removes the brach from the mapping stored in the
OBS_PROJECTS GitHub Action variable.

To just print the obsolete projects without deleting them run command `branch2obs.sh -o`.

## Implementation details

The mapping between the Git branch and the target OBS project is stored in the
[OBS_PROJECTS](https://github.com/agama-project/agama/settings/variables/actions/OBS_PROJECTS)
GitHub variable. It is in JSON format and maps the Git branch name to the OBS project name.

The GitHub submission actions check the mapping value for the current branch/tag and if no mapping
is found the submission is skipped.
