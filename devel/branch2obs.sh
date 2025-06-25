#! /usr/bin/bash

# This script configures autosubmission from a GitHub branch to an OBS project.
# Works with the original project and with forks as well.

usage () {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -a              - keep all original build archs (default: build only x86_64)"
  echo "  -b <branch|tag> - source git branch or tag (default: current git branch)"
  echo "  -p <project>    - target OBS project (based on the git branch)"
  echo "  -t              - keep all original build targets (default: disable Leap 16.0)"
  echo "  -h              - print this help"
}

# process command line arguments
while getopts ":ab:hp:t" opt; do
  case ${opt} in
    a)
      ALL_ARCHS=true
      ;;
    b)
      branch="${OPTARG}"
      ;;
    p)
      PROJECT="${OPTARG}"
      ;;
    t)
      ALL_TARGETS=true
      ;;
    h)
      usage
      exit 0
      ;;
    :)
      echo "ERROR: Missing argument for option -${OPTARG}"
      echo
      usage
      exit 1
      ;;
    ?)
      echo "ERROR: Invalid option -${OPTARG}"
      echo
      usage
      exit 1
      ;;
  esac
done

# check if all needed tools are installed
tools=(git gh jq osc)
for tool in "${tools[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Tool \"$tool\" is not installed, please run \"sudo zypper install $tool\""
    exit 1
  fi
done

# check if osc is authenticated
osc_user=$(osc user | sed "s/^\([^:]*\):.*$/\\1/")
if [ -z "$osc_user" ]; then
  echo "ERROR: Cannot read the osc user, please configure osc"
  exit 1
fi

# check if gh is authenticated
if ! gh auth status --active > /dev/null 2>&1; then
  echo "ERROR: Not logged into a GitHub account"
  echo "Run \"gh auth login\" to log into your GitHub account"
  exit 1
fi

# git branch from the command line or the current git branch
BRANCH=${branch-$(git rev-parse --abbrev-ref HEAD)}
echo "Git branch: $BRANCH"

repo_slug=$(gh repo view --json nameWithOwner -q ".nameWithOwner")

# is this repository a GitHub fork?
if [ "$repo_slug" = "agama-project/agama" ]; then
  if [ -z "$PROJECT" ]; then
    if [ "$BRANCH" = "master" ]; then
      PROJECT="systemsmanagement:Agama:Devel"
    else
      PROJECT="systemsmanagement:Agama:branches:${BRANCH}"
    fi
  fi
else
  echo "GitHub fork detected"

  # check if OBS_USER and OBS_PASSWORD are defined in a fork
  gh_obs_user=$(gh -R "$repo_slug" variable get OBS_USER 2> /dev/null)
  if [ -z "$gh_obs_user" ]; then
    echo "ERROR: OBS_USER variable is not defined in the GitHub configuration"
    echo "Run this command to configure your OBS user name:"
    echo "    gh -R \"$repo_slug\" variable set OBS_USER --body \"$osc_user\""
    exit 1
  fi

  if ! gh -R "$repo_slug" secret list 2> /dev/null | grep -q OBS_PASSWORD; then
    echo "ERROR: OBS password is not defined in the GitHub configuration"
    echo "Run this command to configure your OBS password:"
    echo "    gh -R \"$repo_slug\" secret set OBS_PASSWORD"
    exit 1
  fi

  if [ -z "$PROJECT" ]; then
    PROJECT="home:${osc_user}:Agama:branches:${BRANCH}"
  fi
fi

echo "OBS project: $PROJECT"
echo

# check if the project already exists
if osc ls "$PROJECT" > /dev/null 2>&1; then
  echo "Project $PROJECT already exists, not branching"
else
  echo "Creating project $PROJECT..."
  # packages to branch
  packages=(agama agama-installer agama-auto agama-products agama-web-ui rubygem-agama-yast)
  for pkg in "${packages[@]}"; do
    echo "Branching package $pkg"
    # branch the package
    osc branch --nodevelproject systemsmanagement:Agama:Devel "$pkg" "$PROJECT" > /dev/null
    # detach branch so the package is not updated when the original package changes,
    # this also avoids possible conflicts
    osc detachbranch "$PROJECT" "$pkg"
  done

  # disable building on aarch64, ppc64le, i586 and s390x, usually not needed
  if [ "$ALL_ARCHS" != true ]; then
    echo "Disabling build on aarch64, i586, ppc64le and s390x"
    osc meta prj "$PROJECT" | \
      sed "/<arch>aarch64<\/arch>/d;/<arch>i586<\/arch>/d;/<arch>ppc64le<\/arch>/d;/<arch>s390x<\/arch>/d;" | \
      osc meta prj -F - "$PROJECT"
  fi

  # disable Leap 16.0 target
  if [ "$ALL_TARGETS" != true ]; then
    echo "Disabling openSUSE Leap 16.0 build target"
    osc meta prj "$PROJECT" | \
      sed 's#</description>#</description><build><disable repository="openSUSE_Leap_16.0"/><disable repository="images_Leap_16.0"/></build>##' | \
      osc meta prj -F - "$PROJECT"
  fi

  # disable building the agama-installer-Leap image for Tumbleweed, that does not work
  osc meta pkg "$PROJECT" agama-installer-Leap | \
    sed 's#</package>#<build><disable repository="images"/></build></package>##' | \
    osc meta pkg -F - "$PROJECT" agama-installer-Leap

  # enable publishing of the built packages and images (delete the disabled publish section)
  echo "Enable publishing of the build results"
  osc meta prj "$PROJECT" | sed "/^\s*<publish>\s*$/,/^\s*<\/publish>\s*$/d" | \
    osc meta prj -F - "$PROJECT"

  echo "Set project description"
  url=$(gh repo view --json url --jq .url)
  osc meta prj "$PROJECT" | 
    sed -e "s#<url>.*</url>#<url>$url/tree/$BRANCH</url>#" \
      -e "s#<title>.*</title>#<title>Agama from Git</title>#" \
      -e "s#<description>.*</description>#<description>This project contains the latest packages built from repository $repo_slug, branch \"$BRANCH\".</description>#" | \
    osc meta prj -F - "$PROJECT"
fi

# configure OBS_PROJECTS GitHub variable
projects=$(gh -R "$repo_slug" variable get OBS_PROJECTS 2> /dev/null)

if [ -z "$projects" ]; then
  # fallback to empty JSON if not defined yet
  projects="{}"
fi

# insert the mapping for the new branch
echo "$projects" | jq ". += { \"$BRANCH\" : \"$PROJECT\" } " | gh -R "$repo_slug" variable set OBS_PROJECTS

# to really synchronize the GitHub content with OBS trigger the autosubmission jobs if the remote
# brach already exists or print the instructions for later
workflows=(obs-staging-autoinstallation.yml obs-staging-live.yml obs-staging-products.yml obs-staging-rust.yml obs-staging-service.yml obs-staging-web.yml)
if git ls-remote --exit-code --heads origin "$BRANCH" > /dev/null; then
  for workflow in "${workflows[@]}"; do
    echo "Starting GitHub Action $workflow..."
    gh workflow run "$workflow" --ref "$BRANCH"
  done
else
  echo "After creating the remote branch trigger the submission actions on the web"
  echo "or run these commands:"
  echo
  for workflow in "${workflows[@]}"; do
    echo "    gh workflow run \"$workflow\" --ref \"$BRANCH\""
  done
fi

echo
echo "Git branch \"$BRANCH\" is now automatically submitted to OBS project \"$PROJECT\""
