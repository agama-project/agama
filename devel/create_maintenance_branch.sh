#! /bin/bash

# This script is completely untested! Run the script step by step and fix possible issues!

set -euo pipefail

show_help() {
  echo "Usage: $(basename "$0") [options] <branch_name>"
  echo
  echo "Creates a new maintenance branch in Git and configures Open Build Service (OBS) and Weblate to use it."
  echo
  echo "Arguments:"
  echo "  <branch_name>  The name of the maintenance branch to create (mandatory)."
  echo
  echo "Options:"
  echo "  -h, --help     Show this help message and exit."
}

check_dependencies() {
  local dependencies=("curl" "gh" "git" "jq" "osc")
  local missing=()

  for tool in "${dependencies[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
      missing+=("$tool")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: The following required tools are missing: ${missing[*]}" >&2
    exit 1
  fi
}

check_weblate_token() {
  if [ -z "${WEBLATE_API_KEY:-}" ]; then
    echo "ERROR: WEBLATE_API_KEY environment variable is not set." >&2
    echo "It is needed to create new translation components in Weblate." >&2
    echo "You can find your API key at https://l10n.opensuse.org/accounts/profile/#api" >&2
    exit 1
  fi
}

check_ibs_reachability() {
  echo "Checking connectivity to http://api.suse.de..."
  if ! curl -s --connect-timeout 5 -I "http://api.suse.de" &> /dev/null; then
    echo "ERROR: http://api.suse.de is not reachable." >&2
    echo "Please make sure you are connected to the SUSE intranet or VPN." >&2
    exit 1
  fi
  echo "Successfully connected to IBS API"
}

configure_github_autosubmission() {
  local branch_name="$1"

  # configure GitHub to autosubmit the packages to the maintenance project in OBS
  local repo_slug
  repo_slug=$(gh repo view --json nameWithOwner -q ".nameWithOwner")

  if [ "$repo_slug" != "agama-project/agama" ]; then
    echo "ERROR: This script needs to be run in the original repository agama-project/agama." >&2
    exit 1
  fi

  local projects
  projects=$(gh -R "$repo_slug" variable get OBS_PROJECTS 2> /dev/null)

  if [ -z "$projects" ]; then
    # fallback to empty JSON if not defined yet
    projects="{}"
  fi

  # insert the mapping for the new branch
  echo "$projects" | jq ". += { \"$branch_name\" : \"systemsmanagement:Agama:Maintenance:$branch_name\" } " | gh -R "$repo_slug" variable set OBS_PROJECTS

  # trigger the workflows to submit all packages
  workflows=(obs-staging-live.yml obs-staging-products.yml obs-staging-rust.yml obs-staging-service.yml obs-staging-web.yml)
  for workflow in "${workflows[@]}"; do
    echo "Starting GitHub Action $workflow..."
    gh -R "$repo_slug" workflow run "$workflow" --ref "$branch_name"
  done
}

create_git_branch() {
  local branch_name="$1"

  echo "Creating Git branch $branch_name locally and pushing to remote..."
  # make sure the master branch is up to date
  git fetch
  git checkout -b "$branch_name" origin/master
  git push -u origin "$branch_name"
}

readonly AGAMA_PACKAGES=(
  agama
  agama-installer
  agama-integration-tests
  agama-products
  agama-web-ui
  rubygem-agama-yast
)

readonly OBS_MAINTAINERS='  <person userid="IGonzalezSosa" role="maintainer"/>
  <person userid="ancorgs" role="maintainer"/>
  <person userid="dgdavid" role="maintainer"/>
  <person userid="joseivanlopez" role="maintainer"/>
  <person userid="jreidinger" role="maintainer"/>
  <person userid="locilka" role="maintainer"/>
  <person userid="lslezak" role="maintainer"/>
  <person userid="mfilka" role="maintainer"/>
  <person userid="mvidner" role="maintainer"/>
  <person userid="teclator" role="maintainer"/>'

create_obs_project() {
  local branch_name="$1"
  local version="$2"

  # create a new OBS project
  echo "Creating OBS project systemsmanagement:Agama:Maintenance:$branch_name..."
  cat << EOF | osc meta prj "systemsmanagement:Agama:Maintenance:$branch_name" -F -
<project name="systemsmanagement:Agama:Maintenance:$branch_name">
  <title>Agama - maintenance project for $branch_name Git branch</title>
  <description>This project contains the maintenance packages from agama-project/agama GitHub repository from the $branch_name branch.</description>
  <url>https://github.com/agama-project/agama/tree/$branch_name</url>
$OBS_MAINTAINERS
  <build>
    <disable repository="images"/>
  </build>
  <repository name="standard">
    <path project="SUSE:SLFO:Products:SLES:$version" repository="standard"/>
    <arch>x86_64</arch>
    <arch>s390x</arch>
    <arch>aarch64</arch>
    <arch>ppc64le</arch>
  </repository>
  <repository name="images">
    <path project="systemsmanagement:Agama:Maintenance:$branch_name" repository="standard"/>
    <path project="SUSE:SLFO:Products:SLES:$version" repository="standard"/>
    <arch>x86_64</arch>
    <arch>s390x</arch>
    <arch>aarch64</arch>
    <arch>ppc64le</arch>
  </repository>
</project>
EOF

  echo "Maintenance project systemsmanagement:Agama:Maintenance:$branch_name successfully created!"

  # configure the "images" build target to build kiwi images instead of RPMs
  cat << EOF | osc meta prjconf "systemsmanagement:Agama:Maintenance:$branch_name" -F -
%if "%_repository" == "images"
Type: kiwi
Repotype: staticlinks
Patterntype: none

support: kiwi-systemdeps-disk-images
support: kiwi-systemdeps-iso-media
support: kiwi-systemdeps-containers

%ifarch s390x
  support: kiwi-settings
  Substitute: python3-kiwi python3-kiwi mksusecd zstd vim
%endif
%endif
EOF

  # initialize the project by copying the current packages from systemsmanagement:Agama:Devel
  for package in "${AGAMA_PACKAGES[@]}"; do
    echo "Copying package $package from systemsmanagement:Agama:Devel to systemsmanagement:Agama:Maintenance:$branch_name..."
    osc copypac systemsmanagement:Agama:Devel "$package" "systemsmanagement:Agama:Maintenance:$branch_name"
  done

  # create agama-installer-SLES -> agama-installer link
  osc linkpac "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES

  # change the agama-installer-SLES to build the SLES image instead of openSUSE
  osc co "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES
  (
    cd "systemsmanagement:Agama:Maintenance:$branch_name/agama-installer-SLES"
    sed -i "s/openSUSE/SUSE_SLE_$version/" _multibuild
    osc commit -m "Build the SUSE_SLE_$version profile"
  )

  # disable building the openSUSE image
  osc meta pkg "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer |
    sed 's#</build>#<disable repository="images"/></build>#' |
    osc meta pkg -F - "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer
}

create_ibs_project() {
  local branch_name="$1"
  local version="$2"

  echo "Creating IBS project Devel:YaST:Agama:Maintenance:$branch_name..."
  cat << EOF | osc -A https://api.suse.de meta prj "Devel:YaST:Agama:Maintenance:$branch_name" -F -
<project name="Devel:YaST:Agama:Maintenance:$branch_name">
  <title>Agama - maintenance project for $branch_name Git branch</title>
  <description>This project contains the maintenance packages from agama-project/agama GitHub repository from the $branch_name branch.</description>
  <url>https://github.com/agama-project/agama/tree/$branch_name</url>
  <person userid="yast2-maintainers" role="bugowner"/>
$OBS_MAINTAINERS
  <person userid="yast-team" role="maintainer"/>
  <repository name="images">
    <path project="Devel:YaST:Agama:Maintenance:$branch_name" repository="SLES-$version"/>
    <path project="SUSE:SLFO:Products:SLES:$version" repository="images"/>
    <arch>x86_64</arch>
    <arch>aarch64</arch>
    <arch>ppc64le</arch>
    <arch>s390x</arch>
  </repository>
  <repository name="SLES-$version">
    <path project="SUSE:SLFO:Products:SLES:$version" repository="standard"/>
    <arch>x86_64</arch>
    <arch>aarch64</arch>
    <arch>ppc64le</arch>
    <arch>s390x</arch>
  </repository>
</project>
EOF

  # configure the "images" build target to build kiwi images instead of RPMs
  cat << EOF | osc -A https://api.suse.de meta prjconf "Devel:YaST:Agama:Maintenance:$branch_name" -F -
%if "%_repository" == "images"
Type: kiwi
Repotype: staticlinks
Patterntype: none

support: kiwi-systemdeps-disk-images
support: kiwi-systemdeps-iso-media
support: kiwi-systemdeps-containers
%endif
EOF

  echo "Maintenance project Devel:YaST:Agama:Maintenance:$branch_name successfully created!"

  # link the IBS package to the OBS
  for package in "${AGAMA_PACKAGES[@]}"; do
    echo "Linking package $package from openSUSE.org:systemsmanagement:Agama:Maintenance:$branch_name to Devel:YaST:Agama:Maintenance:$branch_name..."
    osc -A https://api.suse.de linkpac "openSUSE.org:systemsmanagement:Agama:Maintenance:$branch_name" "$package" "Devel:YaST:Agama:Maintenance:$branch_name"
  done

  # link also agama-installer-SLES
  osc -A https://api.suse.de linkpac "openSUSE.org:systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES "Devel:YaST:Agama:Maintenance:$branch_name"

  # disable building the openSUSE image
  osc -A https://api.suse.de meta pkg "Devel:YaST:Agama:Maintenance:$branch_name" agama-installer |
    sed 's#</package>#<build><disable repository="images"/></build></package>#' |
    osc -A https://api.suse.de meta pkg -F - "Devel:YaST:Agama:Maintenance:$branch_name" agama-installer
}

# adapt the translation GitHub Actions
adapt_translation_workflows() {
  local branch_name="$1"
  local version="$2"

  # create file name from the branch name: remove dashes, convert uppercase letters to lowercase
  local file_suffix="${branch_name//-/}"
  file_suffix="${file_suffix,,}"

  # copy files
  local repo_root
  repo_root=$(git rev-parse --show-toplevel)
  cp "$repo_root/.github/workflows/weblate-merge-po-sle16.yml" "$repo_root/.github/workflows/weblate-merge-po-$file_suffix.yml"
  cp "$repo_root/.github/workflows/weblate-merge-products-po-sle16.yml" "$repo_root/.github/workflows/weblate-merge-products-po-$file_suffix.yml"
  cp "$repo_root/.github/workflows/weblate-merge-service-po-sle16.yml" "$repo_root/.github/workflows/weblate-merge-service-po-$file_suffix.yml"
  # TODO: handle the Rust translations by the script after the initial 16.1 version is created manually
  # cp "$repo_root/.github/workflows/weblate-merge-rust-po.yml" "$repo_root/.github/workflows/weblate-merge-rust-po-$file_suffix.yml"

  # change the branch name
  sed -i "s/SLE-16/$branch_name/g" "$repo_root/.github/workflows/weblate-merge-po-$file_suffix.yml"
  sed -i "s/SLE-16/$branch_name/g" "$repo_root/.github/workflows/weblate-merge-products-po-$file_suffix.yml"
  sed -i "s/SLE-16/$branch_name/g" "$repo_root/.github/workflows/weblate-merge-service-po-$file_suffix.yml"

  # change the used container
  sed -i "s@registry.opensuse.org/opensuse/leap:16.0@registry.opensuse.org/opensuse/leap:$version@" "$repo_root/.github/workflows/weblate-merge-po-$file_suffix.yml"
  sed -i "s@registry.opensuse.org/opensuse/leap:16.0@registry.opensuse.org/opensuse/leap:$version@" "$repo_root/.github/workflows/weblate-merge-products-po-$file_suffix.yml"
  sed -i "s@registry.opensuse.org/opensuse/leap:16.0@registry.opensuse.org/opensuse/leap:$version@" "$repo_root/.github/workflows/weblate-merge-service-po-$file_suffix.yml"

  # commit and push the new files
  local pr_branch="translation-workflows-$file_suffix"
  git checkout -b "$pr_branch" origin/master
  git add ".github/workflows/weblate-merge-po-$file_suffix.yml"
  git add ".github/workflows/weblate-merge-products-po-$file_suffix.yml"
  git add ".github/workflows/weblate-merge-service-po-$file_suffix.yml"
  git commit -m "Added translation workflow files for the $branch_name branch"
  git push -u origin "$pr_branch"

  # create a pull request
  gh pr create -B master -H "$pr_branch" \
    --title "Translation workflow files for the $branch_name branch" \
    --body "Automatically create pull requests for the $branch_name translations"
}

create_weblate_branch() {
  local branch_name="$1"

  echo "Creating branch $branch_name in agama-project/agama-weblate..."
  local source_sha
  source_sha=$(gh api "repos/agama-project/agama-weblate/git/ref/heads/master" --jq '.object.sha')
  gh api --method POST "repos/agama-project/agama-weblate/git/refs" \
    -f ref="refs/heads/$branch_name" \
    -f sha="$source_sha" > /dev/null
}

create_weblate_components() {
  local branch_name="$1"

  local components=(
    "products:Agama Products"
    "service:Agama Service"
    "web:Agama Web"
  )

  echo "Creating Weblate components for $branch_name..."

  for item in "${components[@]}"; do
    local type="${item%%:*}"
    local label="${item#*:}"

    # Weblate component slugs must be lowercase and contain only valid characters (no dots)
    local branch_slug="${branch_name,,}"
    branch_slug="${branch_slug//./-}"
    local target_slug="agama-$type-$branch_slug"

    # The source component slug must be strictly lowercase
    local from_comp="agama/agama-$type-sle-16"

    echo "Creating Weblate component for $branch_name based on agama-$type-sle-16..."
    local create_url="https://l10n.opensuse.org/api/projects/agama/components/"

    # https://docs.weblate.org/en/latest/api.html#post--api-projects-(string-project)-components-
    local payload
    payload=$(jq -n --arg fc "$from_comp" --arg name "agama-$type-$branch_name" --arg slug "$target_slug" \
      '{ from_component: $fc, name: $name, slug: $slug }')

    curl -f -X POST \
      -H "Authorization: Token $WEBLATE_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "$create_url"

    # # FIXME: for some reason this does not work, the PUT request returns Error 400 :-/
    # # fix this later, so far the new components need to be edited in the web UI
    #
    # local update_url="https://l10n.opensuse.org/api/components/agama/$target_slug/"
    #
    # # Fetch component configuration, change the branch name and update it back
    # # https://docs.weblate.org/en/latest/api.html#get--api-components-(string-project)-(string-component)-
    # # keep only the requested attributes
    # # https://docs.weblate.org/en/latest/api.html#put--api-components-(string-project)-(string-component)-
    # curl -s -f -H "Authorization: Token $WEBLATE_API_KEY" "$update_url" |
    #   jq --arg branch "$branch_name" '
    #     .branch = $branch |
    #     {
    #       branch,
    #       file_format,
    #       file_format_params,
    #       filemask,
    #       name,
    #       slug,
    #       repo,
    #       template,
    #       new_base,
    #       vcs,
    #       vcs_params,
    #       hide_glossary_matches,
    #       contribute_project_tm
    #     } | with_entries(select(.value != null))' |
    #   curl -s -f -X PUT \
    #     -H "Authorization: Token $WEBLATE_API_KEY" \
    #     -H "Content-Type: application/json" \
    #     -d @- \
    #     "$update_url"
    #
    # echo "Weblate component $target_slug successfully created!"
  done
}

BRANCH_NAME=""

# parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
  -h | --help)
    show_help
    exit 0
    ;;
  -*)
    echo "Error: Unknown option '$1'" >&2
    show_help >&2
    exit 1
    ;;
  *)
    if [ -n "$BRANCH_NAME" ]; then
      echo "Error: Multiple branch names provided." >&2
      show_help >&2
      exit 1
    fi
    BRANCH_NAME="$1"
    shift
    ;;
  esac
done

# validate mandatory argument
if [ -z "$BRANCH_NAME" ]; then
  echo "ERROR: Maintenance branch name is a required argument." >&2
  show_help >&2
  exit 1
fi

check_weblate_token

# verify that all required commands are available before proceeding
check_dependencies

# verify IBS API is reachable before attempting project setup
check_ibs_reachability

# extract the version from the branch name (e.g. "16.1" from "SLE-16.1")
VERSION="${BRANCH_NAME##*-}"
echo "Creating maintenance branch \"$BRANCH_NAME\" for version $VERSION..."

create_git_branch "$BRANCH_NAME"

create_obs_project "$BRANCH_NAME" "$VERSION"

create_ibs_project "$BRANCH_NAME" "$VERSION"

configure_github_autosubmission "$BRANCH_NAME"

adapt_translation_workflows "$BRANCH_NAME" "$VERSION"

# branch the agama-weblate repository as well using the gh tool
create_weblate_branch "$BRANCH_NAME"

# create new translation components in Weblate
create_weblate_components "$BRANCH_NAME"

echo
echo "NOTES:"
echo " - Manually copy the .github/workflows/weblate-merge-rust-po.yml and adapt it for the $BRANCH_NAME branch, update this script to do that automatically next time."
