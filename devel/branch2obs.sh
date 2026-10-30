#! /usr/bin/bash

# This script configures autosubmission from a GitHub branch to an OBS project.
# Works with the original project and with forks as well.

IBS_URL="https://api.suse.de"
IBS_DEVEL_PROJECT="Devel:YaST:Agama:Head"

# packages to branch
PACKAGES=(agama agama-installer agama-products agama-web-ui rubygem-agama-yast)

usage () {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -a              - keep all original build archs (default: build only x86_64)"
  echo "  -b <branch|tag> - source git branch or tag (default: current git branch)"
  echo "  -i [project]    - additionally create a project in the internal OBS (${IBS_URL}),"
  echo "                    it is branched from ${IBS_DEVEL_PROJECT} and the packages are linked"
  echo "                    to the project in the public OBS (default project name is based"
  echo "                    on the git branch)"
  echo "  -p <project>    - target OBS project (based on the git branch)"
  echo "  -t              - keep all original build targets (default: disable Leap 16.0)"
  echo "  -c              - cleanup (delete) all obsolete projects, exclusive option,"
  echo "                    all other options are ignored, the internal OBS is included"
  echo "                    if it is reachable"
  echo "  -o              - print obsolete projects, similar to -c but only print"
  echo "                    the projects instead of deleting them"
  echo "  -h              - print this help"
}

# process command line arguments
while getopts ":ab:chiop:t" opt; do
  case ${opt} in
    a)
      ALL_ARCHS=true
      ;;
    b)
      branch="${OPTARG}"
      ;;
    c)
      CLEANUP=true
      ;;
    i)
      IBS=true
      # getopts does not support optional arguments, use the next word as the project
      # name if it is not another option
      next="${!OPTIND}"
      if [ -n "$next" ] && [[ "$next" != -* ]]; then
        IBS_PROJECT="$next"
        OPTIND=$((OPTIND + 1))
      fi
      ;;
    o)
      OBSOLETE=true
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

# check if osc is authenticated in the internal OBS, the connection requires the SUSE VPN
# (the timeout avoids hanging when the server is not reachable)
if [ -n "$IBS" ] || [ -n "$CLEANUP" ] || [ -n "$OBSOLETE" ]; then
  ibs_user=""
  # check the osc configuration first, osc would interactively ask for the credentials otherwise
  if grep -qs "^\[${IBS_URL}/*\]" ~/.oscrc "${XDG_CONFIG_HOME:-$HOME/.config}/osc/oscrc"; then
    ibs_user=$(timeout 15 osc -A "$IBS_URL" user < /dev/null 2> /dev/null | sed "s/^\([^:]*\):.*$/\\1/")
  fi
  if [ -z "$ibs_user" ] && [ -n "$IBS" ] && [ -z "$CLEANUP" ] && [ -z "$OBSOLETE" ]; then
    echo "ERROR: Cannot read the osc user for $IBS_URL, please configure osc"
    echo "and make sure you are connected to the SUSE intranet or VPN"
    exit 1
  fi
fi

# check if gh is authenticated
if ! gh auth status --active > /dev/null 2>&1; then
  echo "ERROR: Not logged into a GitHub account"
  echo "Run \"gh auth login\" to log into your GitHub account"
  exit 1
fi

repo_slug=$(gh repo view --json nameWithOwner -q ".nameWithOwner")

# Find (and optionally delete) the obsolete projects, i.e. the projects with a missing Git branch.
# Arguments: <project prefix> [osc options...], the number of obsolete projects is added to $counter
scan_obsolete_projects() {
  local prefix="$1"
  shift
  local osc_opts=("$@")

  # find the matching projects
  local obs_projects
  mapfile -t obs_projects < <(osc "${osc_opts[@]}" search --substring --project "$prefix" | grep "$prefix" | grep -v "^matches for")

  local project branch_name config
  for project in "${obs_projects[@]}"; do
    # remove the prefix to get the related Git branch
    branch_name=$(echo -n "$project" | sed -e "s/^$prefix://")
    if ! git ls-remote --exit-code --heads origin "$branch_name" > /dev/null; then
      if [ -n "$CLEANUP" ]; then
        echo "Deleting obsolete project $project..."
        # recursive remote delete (allows deleting a non-empty project)
        osc "${osc_opts[@]}" rdelete --recursive --force --message "Deleting obsolete project" "$project"

        # the GitHub mapping exists only for the public OBS projects
        if [ ${#osc_opts[@]} -eq 0 ]; then
          config=$(gh -R "$repo_slug" variable get OBS_PROJECTS 2> /dev/null)
          if [ -n "$config" ]; then
            # remove the mapping for the deleted project
            echo "$config" | jq "del(.[\"$branch_name\"])" | gh -R "$repo_slug" variable set OBS_PROJECTS
          fi
        fi
      else
        echo "Found obsolete project: $project"
      fi
      ((counter++))
    fi
  done
}

if [ -n "$CLEANUP" ] || [ -n "$OBSOLETE" ]; then
  # count the obsolete projects for the final summary
  counter=0

  echo "Scanning obsolete projects in OBS..."
  if [ "$repo_slug" = "agama-project/agama" ]; then
    # the upstream repository
    scan_obsolete_projects "systemsmanagement:Agama:branches"
  else
    # a fork
    scan_obsolete_projects "home:${osc_user}:Agama:branches"
  fi

  if [ -n "$ibs_user" ]; then
    echo "Scanning obsolete projects in the internal OBS ($IBS_URL)..."
    if [ "$repo_slug" = "agama-project/agama" ]; then
      scan_obsolete_projects "Devel:YaST:Agama:branches" -A "$IBS_URL"
    else
      scan_obsolete_projects "home:${ibs_user}:Agama:branches" -A "$IBS_URL"
    fi
  else
    echo "Skipping the internal OBS ($IBS_URL), osc is not configured for it or it is not reachable"
  fi

  # print a summary
  echo "Found $counter obsolete projects"

  # cleanup and check are exclusive options, finish the script
  exit 0
fi

# git branch from the command line or the current git branch
BRANCH=${branch-$(git rev-parse --abbrev-ref HEAD)}
echo "Git branch: $BRANCH"

# the master branch of the upstream repository is already handled, nothing to do
if [ -n "$IBS" ] && [ "$BRANCH" = "master" ] && [ "$repo_slug" = "agama-project/agama" ]; then
  echo "The master branch is already configured, nothing to do"
  exit 0
fi

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
  for pkg in "${PACKAGES[@]}"; do
    echo "Branching package $pkg"
    # branch the package
    osc branch --nodevelproject systemsmanagement:Agama:Devel "$pkg" "$PROJECT" > /dev/null
    # detach branch so the package is not updated when the original package changes,
    # this also avoids possible conflicts
    osc detachbranch "$PROJECT" "$pkg"
  done

  # disable building on aarch64, armv6l, armv7l, i586, ppc64le, riscv64 and s390x, usually not needed
  if [ "$ALL_ARCHS" != true ]; then
    echo "Disabling build on aarch64, armv6l, armv7l, i586, ppc64le, riscv64 and s390x"
    osc meta prj "$PROJECT" | \
      sed "/<arch>aarch64<\/arch>/d;/<arch>armv6l<\/arch>/d;/<arch>armv7l<\/arch>/d;/<arch>i586<\/arch>/d;/<arch>ppc64le<\/arch>/d;/<arch>riscv64<\/arch>/d;/<arch>s390x<\/arch>/d;" | \
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

if [ -n "$IBS" ]; then
  if [ -z "$IBS_PROJECT" ]; then
    if [ "$repo_slug" = "agama-project/agama" ]; then
      IBS_PROJECT="Devel:YaST:Agama:branches:${BRANCH}"
    else
      IBS_PROJECT="home:${ibs_user}:Agama:branches:${BRANCH}"
    fi
  fi

  echo
  echo "Internal OBS project: $IBS_PROJECT"

  if osc -A "$IBS_URL" ls "$IBS_PROJECT" > /dev/null 2>&1; then
    echo "Project $IBS_PROJECT already exists in $IBS_URL, not branching"
  else
    echo "Creating project $IBS_PROJECT in $IBS_URL..."

    # branch just the first package, that creates the project (copying the repository
    # configuration from the original project), the packages are replaced by links below
    osc -A "$IBS_URL" branch --nodevelproject "$IBS_DEVEL_PROJECT" "${PACKAGES[0]}" "$IBS_PROJECT" > /dev/null

    # link the packages to the project in the public OBS
    for pkg in "${PACKAGES[@]}"; do
      if osc -A "$IBS_URL" meta pkg "$IBS_PROJECT" "$pkg" > /dev/null 2>&1; then
        # remove the branched package
        osc -A "$IBS_URL" rdelete --force --message "Replacing the branch with a link" "$IBS_PROJECT" "$pkg"
      fi
      echo "Linking package $pkg from openSUSE.org:$PROJECT"
      osc -A "$IBS_URL" linkpac "openSUSE.org:$PROJECT" "$pkg" "$IBS_PROJECT"
    done

    # disable building on all archs except x86_64, usually not needed
    if [ "$ALL_ARCHS" != true ]; then
      echo "Disabling build on aarch64, armv6l, armv7l, i586, ppc64le, riscv64 and s390x"
      osc -A "$IBS_URL" meta prj "$IBS_PROJECT" | \
        sed "/<arch>aarch64<\/arch>/d;/<arch>armv6l<\/arch>/d;/<arch>armv7l<\/arch>/d;/<arch>i586<\/arch>/d;/<arch>ppc64le<\/arch>/d;/<arch>riscv64<\/arch>/d;/<arch>s390x<\/arch>/d;" | \
        osc -A "$IBS_URL" meta prj -F - "$IBS_PROJECT"
    fi

    echo "Set project description"
    url=$(gh repo view --json url --jq .url)
    osc -A "$IBS_URL" meta prj "$IBS_PROJECT" |
      sed -e "s#<url>.*</url>#<url>$url/tree/$BRANCH</url>#" \
        -e "s#<title>.*</title>#<title>Agama from Git</title>#" \
        -e "s#<description>.*</description>#<description>This project contains the latest packages built from repository $repo_slug, branch \"$BRANCH\".</description>#" | \
      osc -A "$IBS_URL" meta prj -F - "$IBS_PROJECT"
  fi
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
workflows=(obs-staging-live.yml obs-staging-products.yml obs-staging-rust.yml obs-staging-service.yml obs-staging-web.yml)
if git ls-remote --exit-code --heads origin "$BRANCH" > /dev/null; then
  for workflow in "${workflows[@]}"; do
    echo "Starting GitHub Action $workflow..."
    gh -R "$repo_slug" workflow run "$workflow" --ref "$BRANCH"
  done
else
  echo "After creating the remote branch trigger the submission actions on the web"
  echo "or run these commands:"
  echo
  for workflow in "${workflows[@]}"; do
    echo "    gh -R \"$repo_slug\" workflow run \"$workflow\" --ref \"$BRANCH\""
  done
fi

echo
echo "Git branch \"$BRANCH\" is now automatically submitted to OBS project \"$PROJECT\""
if [ -n "$IBS" ]; then
  echo "The packages in the internal OBS project \"$IBS_PROJECT\" are linked to it"
fi
