#! /bin/bash

# This script is completely untested! Run the script step by step and fix possible issues!

set -euo pipefail

# Template defaults for copying components
readonly TPL_WEBLATE_COMP="sle-16-1"

# Print usage.
show_help() {
  echo "Usage: $(basename "$0") [options] <branch_name>"
  echo
  echo "Creates a new maintenance branch in Git and configures Open Build Service (OBS) and Weblate to use it."
  echo
  echo "Arguments:"
  echo "  <branch_name>  The name of the maintenance branch to create (mandatory)."
  echo "                 Must contain a hyphen before the version (e.g. SLE-16.1)."
  echo
  echo "Options:"
  echo "  -h, --help     Show this help message and exit."
}

check_clean_working_tree() {
  if ! git diff-index --quiet HEAD --; then
    echo "ERROR: Working tree is not clean. Please commit or stash your changes first." >&2
    exit 1
  fi
}

# Exit if any required CLI tool is missing in $PATH.
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

# Exit if $WEBLATE_API_KEY is not set.
check_weblate_token() {
  if [ -z "${WEBLATE_API_KEY:-}" ]; then
    echo "ERROR: WEBLATE_API_KEY environment variable is not set." >&2
    echo "It is needed to create new translation components in Weblate." >&2
    echo "You can find your API key at https://l10n.opensuse.org/accounts/profile/#api" >&2
    exit 1
  fi
}

# Exit if the IBS API (api.suse.de) is not reachable, requires the SUSE VPN.
check_ibs_reachability() {
  echo "Checking connectivity to http://api.suse.de..."
  if ! curl -s --connect-timeout 5 -I "http://api.suse.de" &> /dev/null; then
    echo "ERROR: http://api.suse.de is not reachable." >&2
    echo "Please make sure you are connected to the SUSE intranet or VPN." >&2
    exit 1
  fi
  echo "Successfully connected to IBS API"
}

# Map the branch to its OBS project in the OBS_PROJECTS GitHub variable
# and trigger the OBS submit workflows on that branch.
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
  projects=$(gh -R "$repo_slug" variable get OBS_PROJECTS 2> /dev/null || echo "")

  if [ -z "$projects" ]; then
    # fallback to empty JSON if not defined yet
    projects="{}"
  fi

  # insert the mapping for the new branch
  echo "$projects" | jq ". += { \"$branch_name\" : \"systemsmanagement:Agama:Maintenance:$branch_name\" } " | gh -R "$repo_slug" variable set OBS_PROJECTS

  # trigger the workflows to submit all packages
  local workflows=(obs-staging-live.yml obs-staging-products.yml obs-staging-rust.yml obs-staging-service.yml obs-staging-web.yml)
  for workflow in "${workflows[@]}"; do
    echo "Starting GitHub Action $workflow..."
    gh -R "$repo_slug" workflow run "$workflow" --ref "$branch_name"
  done
}

# Create the branch from origin/master and push it.
create_git_branch() {
  local branch_name="$1"

  if git ls-remote --exit-code --heads origin "$branch_name" >/dev/null; then
    echo "Branch $branch_name already exists on remote origin. Skipping branch creation."
    git fetch
    git checkout "$branch_name"
    git branch --set-upstream-to="origin/$branch_name" "$branch_name"
  else
    echo "Creating Git branch $branch_name locally and pushing to remote..."
    # make sure the master branch is up to date
    git fetch
    git checkout -b "$branch_name" origin/master
    git push -u origin "$branch_name"
  fi
}

# Protect the branch on GitHub: PR with 1 approval required, no bypass, no force push.
configure_branch_protection() {
  local branch_name="$1"

  # require a pull request with at least one approval, do not allow bypassing
  # the rules (not even by admins), do not allow force pushes and deleting the branch
  # https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection
  echo "Configuring branch protection for $branch_name..."
  gh api --method PUT "repos/agama-project/agama/branches/$branch_name/protection" --input - > /dev/null << EOF
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "bypass_pull_request_allowances": {
      "users": [],
      "teams": [],
      "apps": []
    }
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
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

# Create the systemsmanagement:Agama:Maintenance:<branch> OBS project built against
# SLES <version>, copy the packages from systemsmanagement:Agama:Devel and add agama-installer-SLES.
create_obs_project() {
  local branch_name="$1"
  local version="$2"

  # create a new OBS project
  echo "Creating OBS project systemsmanagement:Agama:Maintenance:$branch_name..."
  osc meta prj "systemsmanagement:Agama:Maintenance:$branch_name" -F - << EOF
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
  osc meta prjconf "systemsmanagement:Agama:Maintenance:$branch_name" -F - << EOF
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
    if osc meta pkg "systemsmanagement:Agama:Maintenance:$branch_name" "$package" &>/dev/null; then
      echo "Package $package already exists in systemsmanagement:Agama:Maintenance:$branch_name, skipping copy."
    else
      echo "Copying package $package from systemsmanagement:Agama:Devel to systemsmanagement:Agama:Maintenance:$branch_name..."
      osc copypac systemsmanagement:Agama:Devel "$package" "systemsmanagement:Agama:Maintenance:$branch_name"
    fi
  done

  # create agama-installer-SLES -> agama-installer link
  if ! osc meta pkg "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES &>/dev/null; then
    osc linkpac "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES
  fi

  # change the agama-installer-SLES to build the SLES image instead of openSUSE
  local tmp_dir
  tmp_dir=$(mktemp -d)
  (
    cd "$tmp_dir"
    osc co "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES
    cd "systemsmanagement:Agama:Maintenance:$branch_name/agama-installer-SLES"
    if [ -f _multibuild ]; then
      sed -i "s/openSUSE/SUSE_SLE_$version/" _multibuild
      if ! git diff --quiet _multibuild 2>/dev/null || [ -n "$(git status --porcelain 2>/dev/null)" ]; then
         osc commit -m "Build the SUSE_SLE_$version profile" || true
      fi
    fi
  )
  rm -rf "$tmp_dir"

  # disable building the openSUSE image
  osc meta pkg "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer |
    sed 's#</build>#<disable repository="images"/></build>#' |
    osc meta pkg -F - "systemsmanagement:Agama:Maintenance:$branch_name" agama-installer
}

# Create the Devel:YaST:Agama:Maintenance:<branch> IBS project with packages linked to the OBS project.
create_ibs_project() {
  local branch_name="$1"
  local version="$2"

  echo "Creating IBS project Devel:YaST:Agama:Maintenance:$branch_name..."
  osc -A https://api.suse.de meta prj "Devel:YaST:Agama:Maintenance:$branch_name" -F - << EOF
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
  osc -A https://api.suse.de meta prjconf "Devel:YaST:Agama:Maintenance:$branch_name" -F - << EOF
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
    if osc -A https://api.suse.de meta pkg "Devel:YaST:Agama:Maintenance:$branch_name" "$package" &>/dev/null; then
      echo "Package $package already linked in Devel:YaST:Agama:Maintenance:$branch_name, skipping."
    else
      echo "Linking package $package from openSUSE.org:systemsmanagement:Agama:Maintenance:$branch_name to Devel:YaST:Agama:Maintenance:$branch_name..."
      osc -A https://api.suse.de linkpac "openSUSE.org:systemsmanagement:Agama:Maintenance:$branch_name" "$package" "Devel:YaST:Agama:Maintenance:$branch_name"
    fi
  done

  # link also agama-installer-SLES
  if ! osc -A https://api.suse.de meta pkg "Devel:YaST:Agama:Maintenance:$branch_name" agama-installer-SLES &>/dev/null; then
    osc -A https://api.suse.de linkpac "openSUSE.org:systemsmanagement:Agama:Maintenance:$branch_name" agama-installer-SLES "Devel:YaST:Agama:Maintenance:$branch_name"
  fi

  # disable building the openSUSE image
  osc -A https://api.suse.de meta pkg "Devel:YaST:Agama:Maintenance:$branch_name" agama-installer |
    sed 's#</package>#<build><disable repository="images"/></build></package>#' |
    osc -A https://api.suse.de meta pkg -F - "Devel:YaST:Agama:Maintenance:$branch_name" agama-installer
}

# Add the branch to the Weblate merge workflow and open a PR against master.
adapt_translation_workflows() {
  local branch_name="$1"
  local version="$2"

  # create file name from the branch name: remove dashes, convert uppercase letters to lowercase
  local file_suffix="${branch_name//-/}"
  file_suffix="${file_suffix,,}"

  # create a new branch
  local pr_branch="translation-workflows-$file_suffix"
  local original_branch
  original_branch=$(git rev-parse --abbrev-ref HEAD)

  git checkout -b "$pr_branch" origin/master

  local repo_root
  repo_root=$(git rev-parse --show-toplevel)
  local workflow="$repo_root/.github/workflows/weblate-merge-po.yml"

  if grep -q -E "^ *- branch: $branch_name\$" "$workflow"; then
    echo "The $branch_name branch is already present in the Weblate merge workflow."
  else
    # add the branch to the build matrix
    sed -i -E "s/^( *branch: \[.*)\]/\1, $branch_name]/" "$workflow"

    # add the branch specific settings (container image, repositories) at the end
    # of the per-branch settings, the new entry is placed before the blank line
    # preceding the per-component settings
    sed -i -z -E "s/\n\n( *# per-component settings)/\n          - branch: $branch_name\n            image: registry.opensuse.org\/opensuse\/leap:$version\n            disable_repos: openSUSE:repo-openh264\n\n\1/" "$workflow"

    git add "$workflow"
  fi

  if ! git diff --cached --quiet; then
    git commit -m "Added translation workflow settings for the $branch_name branch"
    git push -u origin "$pr_branch"

    # create a pull request
    gh pr create -B master -H "$pr_branch" \
      --title "Translation workflow settings for the $branch_name branch" \
      --body "Automatically create pull requests for the $branch_name translations"
  else
    echo "Translation workflow settings already exist for $branch_name. Skipping PR creation."
  fi

  # return to the original branch
  git checkout "$original_branch"
}

# Create the branch in agama-project/agama-weblate from its master.
create_weblate_branch() {
  local branch_name="$1"

  if gh api "repos/agama-project/agama-weblate/git/ref/heads/$branch_name" --silent 2>/dev/null; then
    echo "Branch $branch_name already exists in agama-weblate. Skipping creation."
  else
    echo "Creating branch $branch_name in agama-project/agama-weblate..."
    local source_sha
    source_sha=$(gh api "repos/agama-project/agama-weblate/git/ref/heads/master" --jq '.object.sha')
    gh api --method POST "repos/agama-project/agama-weblate/git/refs" \
      -f ref="refs/heads/$branch_name" \
      -f sha="$source_sha" > /dev/null
  fi
}

# Create the Weblate components for the branch, settings are copied from the templates.
create_weblate_components() {
  local branch_name="$1"

  local components=(
    "web:Agama Web"
    "products:Agama Products"
    "service:Agama Service"
    "rust:Agama Rust"
  )

  echo "Creating Weblate components for $branch_name..."

  for item in "${components[@]}"; do
    local type="${item%%:*}"

    # Weblate component slugs must be lowercase and contain only valid characters (no dots)
    local branch_slug="${branch_name,,}"
    branch_slug="${branch_slug//./-}"
    local target_slug="agama-$type-$branch_slug"

    # check if it exists
    if curl -s -f -H "Authorization: Token $WEBLATE_API_KEY" "https://l10n.opensuse.org/api/components/agama/$target_slug/" > /dev/null; then
      echo "Weblate component $target_slug already exists. Skipping."
      continue
    fi

    # the existing template component is used as a template for the new component
    local source_url="https://l10n.opensuse.org/api/components/agama/agama-$type-$TPL_WEBLATE_COMP/"
    local create_url="https://l10n.opensuse.org/api/projects/agama/components/"

    echo "Creating Weblate component \"$target_slug\" for branch $branch_name..."

    # fetch the template component configuration, keep only the relevant writable attributes
    # and change the name, slug and branch
    # https://docs.weblate.org/en/latest/api.html#get--api-components-(string-project)-(string-component)-
    local payload
    payload=$(curl -s -f -H "Authorization: Token $WEBLATE_API_KEY" "$source_url" |
      jq --arg name "agama-$type-$branch_name" --arg slug "$target_slug" --arg branch "$branch_name" \
        --arg web_slug "agama-web-$branch_slug" '
        (.linked_component != null) as $linked
        | {
          name: $name,
          slug: $slug,
          vcs,
          repo,
          push,
          branch: $branch,
          filemask,
          template,
          new_base,
          file_format,
          repoweb,
          new_lang,
          language_regex,
          merge_style,
          push_on_commit,
          commit_pending_age,
          auto_lock_error,
          allow_translation_propagation,
          hide_glossary_matches,
          contribute_project_tm,
          enable_suggestions,
          manage_units,
          priority
        }
        # the linked components share the Git repository with the new web component,
        # the push URL and the branch are inherited from it
        | if $linked then .repo = "weblate://agama/\($web_slug)" | del(.push, .branch) else . end
      ')

    # https://docs.weblate.org/en/latest/api.html#post--api-projects-(string-project)-components-
    local response
    if ! response=$(echo "$payload" | curl -s --fail-with-body -X POST \
      -H "Authorization: Token $WEBLATE_API_KEY" \
      -H "Content-Type: application/json" \
      -d @- \
      "$create_url"); then
      echo "ERROR: Cannot create Weblate component $target_slug: $response" >&2
      exit 1
    fi

    echo "Weblate component $target_slug successfully created!"
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

# validate branch formatting (must contain a hyphen and a version string)
if [[ ! "$BRANCH_NAME" =~ -[0-9]+(\.[0-9]+)?$ ]]; then
  echo "ERROR: Branch name must contain a hyphen before the version (e.g., SLE-16.1)." >&2
  exit 1
fi

# check working tree status
check_clean_working_tree

# check that the Weblate token is defined
check_weblate_token

# verify that all required commands are available before proceeding
check_dependencies

# verify IBS API is reachable before attempting project setup
check_ibs_reachability

# extract the version from the branch name (e.g. "16.1" from "SLE-16.1")
VERSION="${BRANCH_NAME##*-}"
echo "Creating maintenance branch \"$BRANCH_NAME\" for version $VERSION..."

# create the actual branch in Git
create_git_branch "$BRANCH_NAME"

# create maintenance project in OBS
create_obs_project "$BRANCH_NAME" "$VERSION"

# create maintenance project in IBS
create_ibs_project "$BRANCH_NAME" "$VERSION"

# configure autosubmission to OBS
configure_github_autosubmission "$BRANCH_NAME"

# add Weblate CI jobs
adapt_translation_workflows "$BRANCH_NAME" "$VERSION"

# protect the new branch
configure_branch_protection "$BRANCH_NAME"

# branch the agama-weblate repository
create_weblate_branch "$BRANCH_NAME"

# create new translation components in Weblate
create_weblate_components "$BRANCH_NAME"
