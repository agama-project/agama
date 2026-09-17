#!/bin/bash
#
# Agama Auto-Installation Profile Generator for CC compliant systems.
#
# Interactively collects the credentials and the settings needed for a Common
# Criteria (CC) / FIPS hardened SLES installation, builds an Agama JSON profile
# from agama-template.json and drives the installation via the Agama CLI and
# its local REST API.
#
# See SPECIFICATION.md for the requirements this script implements.
#
# Usage: cc-install.sh [--plain|--dialog] [--template FILE] [--dry-run] [--help]

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

readonly PROGRAM_NAME="FIPS/CC Installation"
readonly BACKTITLE="SUSE Linux Enterprise Server 16.0 - FIPS / Common Criteria installation"

readonly LICENSE_FILE="/usr/share/agama/eula/license.final/license.txt"
# the JSON template installed with the package, used when there is none next to
# the script
readonly SYSTEM_TEMPLATE="/usr/share/cc-setup/agama-template.json"
readonly DRACUT_NTP_FILE="/run/chrony/dracut.sources.d/dracut.sources"
# the NTP configuration of the installed system, written via the "files"
# section of the profile
readonly NTP_DESTINATION="/etc/chrony.d/50-cc-install.conf"
readonly NTP_PERMISSIONS="0644"
# the packages on the installation medium; when it is missing the packages must
# be downloaded from the registration server and the registration is mandatory
readonly LOCAL_REPO_DIR="/run/initramfs/live/install"
readonly CMDLINE_FILE="/proc/cmdline"
# the RMT server URL is passed to Agama on the boot command line
readonly RMT_URL_OPTION="inst.register_url"
readonly AGAMA_TOKEN_FILE="/run/agama/token"
readonly API_URL="http://localhost/api/manager/installer"
# the storage actions of the current proposal, each object has a "text" attribute
readonly STORAGE_ACTIONS_URL="http://localhost/api/storage/devices/actions"
# the available keyboard layouts, objects with "id" and "description" keys
readonly KEYMAPS_URL="http://localhost/api/l10n/keymaps"

# Installation phase reported by the Agama API when everything is installed.
readonly FINISH_PHASE=3
readonly POLL_INTERVAL=10          # seconds between two API polls
readonly PROGRESS_HEARTBEAT=60     # report the elapsed time when nothing happens
readonly MAX_API_FAILURES=30       # consecutive API errors tolerated
readonly MAX_INSTALL_SECONDS=14400 # ask whether to keep waiting after 4 hours
readonly WAIT_QUESTION_TIMEOUT=300 # unanswered "keep waiting?" means "yes"

# The license text box should use the whole terminal, these lines are left for
# the frame, the title and the button. The dialog default (auto size) is used
# when the terminal is smaller than the minimum or its size is unknown.
readonly DIALOG_HEIGHT_MARGIN=5
readonly MIN_TERMINAL_HEIGHT=10

# A dialog with an input field (inputbox, passwordbox) needs 7 lines around the
# message: the frame, the input field with its own frame, the separator and the
# buttons. DIALOG_TEXT_MARGIN is the frame and the padding around the message,
# DIALOG_INPUT_WIDTH the default width of such a dialog.
readonly DIALOG_INPUT_MARGIN=7
# a menu needs this many lines around the list of the items
readonly DIALOG_MENU_MARGIN=8
readonly DIALOG_TEXT_MARGIN=4
readonly DIALOG_INPUT_WIDTH=70
readonly MIN_TERMINAL_WIDTH=40
# the messages are written as one long line per paragraph and wrapped to this
# width by the line interface (dialog wraps them itself)
readonly LINE_TEXT_WIDTH=76

# Defaults for the first user account (see SPECIFICATION.md).
readonly DEFAULT_USER_NAME="sysadmin"
readonly DEFAULT_FULL_NAME="System Administrator"

# --- Validation policy -----------------------------------------------------
# TODO(security team): the final validation rules are still to be defined,
# everything in this block is a placeholder.  The password strength itself is
# delegated to cracklib-check.
readonly MIN_PASSWORD_LENGTH=8
readonly MAX_PASSWORD_LENGTH=128
readonly USER_NAME_REGEX='^[a-z_][a-z0-9_-]{0,31}$'
readonly NTP_SERVER_REGEX='^[A-Za-z0-9]([A-Za-z0-9._:-]*[A-Za-z0-9])?$'

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------

DIALOG_MODE=true       # text user interface (dialog) or plain line interface
DRY_RUN=false          # build the profile, but do not touch the system
TEMPLATE=""            # the input JSON template
SECURE_DIR=""          # tmpfs directory for the secrets handed over to jq
MONITOR_PID=""         # PID of the "agama monitor" process
INSTALLATION_STARTED=false
declare -a SCRIPT_ARGS=()

# Collected answers.  Passwords are kept in memory only, they are never
# written to a log, never echoed and never passed on a command line.
ROOT_PASSWORD=""
ROOT_PASSWORD_HASH=""
USER_NAME="$DEFAULT_USER_NAME"
FULL_NAME="$DEFAULT_FULL_NAME"
USER_PASSWORD=""
USER_PASSWORD_HASH=""
LUKS_PASSWORD=""
KEYBOARD=""            # keyboard layout id, empty keeps the default
KEYBOARD_ORIGINAL=""   # layout active in the installer before the first change
KEYBOARD_APPLIED=false # has any layout been applied in the installer?
NTP_SERVER=""
NTP_FROM_DRACUT=false
REGISTRATION_CODE=""
REGISTRATION_EMAIL=""
REGISTRATION_REQUIRED=false
RMT_URL=""             # RMT server from the "inst.register_url" boot option
TARGET_DISK=""
TARGET_DISK_LABEL=""
API_CONF=""            # curl configuration file with the API token
STORAGE_ACTIONS_TEXT="" # the storage actions as reported by Agama
UI_HEIGHT=0            # dialog size requested by the "--size" option of the
UI_WIDTH=0             # ui_* functions, zero means the dialog default

# ---------------------------------------------------------------------------
# Housekeeping
# ---------------------------------------------------------------------------

usage() {
  cat <<EOF
Usage: ${0##*/} [OPTIONS]

  --dialog          force the dialog based text user interface
  --plain           force the simple line interface (serial console)
  --template FILE   Agama JSON profile template (default: agama-template.json
                    next to this script, or /usr/share/cc-setup/agama-template.json)
  --dry-run         only build the profile, do not modify the system
                    (implies CC_NO_REBOOT=1)
  --help            show this help

Environment:
  CC_TEMPLATE       path to the JSON template (same as --template)
  CC_NO_REBOOT=1    never reboot the machine, only report it (for testing)
  CC_LOCALE         override the locale (default: C.UTF-8, for testing)

The generated profile contains the plain text disk encryption passphrase,
therefore it is never stored on disk and never printed.
EOF
}

# The JSON template to use by default: the one next to the script (a git
# checkout) or the one installed with the package.
default_template() {
  local script_dir candidate
  script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

  for candidate in "$script_dir/agama-template.json" "$SYSTEM_TEMPLATE"; do
    if [[ -r $candidate ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  # none of them exists, report the missing one next to the script
  printf '%s' "$script_dir/agama-template.json"
}

parse_arguments() {
  TEMPLATE="${CC_TEMPLATE:-$(default_template)}"

  local ui_forced=false
  while (($# > 0)); do
    case "$1" in
      --dialog) DIALOG_MODE=true; ui_forced=true ;;
      --plain|--text) DIALOG_MODE=false; ui_forced=true ;;
      --template) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; TEMPLATE="$2"; shift ;;
      --template=*) TEMPLATE="${1#*=}" ;;
      --dry-run) DRY_RUN=true ;;
      --help|-h) usage; exit 0 ;;
      *) printf 'Unknown option: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
    esac
    shift
  done

  $ui_forced || detect_ui_mode
}

# Decide whether the dialog interface can be used. The line interface is the
# fallback for the cases where dialog cannot work: it is not installed, there
# is no terminal at all or the terminal cannot display anything.
#
# The dialogs are drawn on the standard error (see show_dialog), so that has to
# be a terminal, and dialog needs a usable TERM. The service which starts the
# tool during the boot connects all three standard streams to the console
# (StandardInput/StandardOutput/StandardError=tty in cc-setup.service).
#
# A serial console is not a reason for the line interface, dialog works over a
# serial line as well; the line interface is chosen with --plain.
detect_ui_mode() {
  DIALOG_MODE=false

  command -v dialog >/dev/null 2>&1 || return 0
  [[ -t 2 ]] || return 0
  dumb_terminal && return 0

  DIALOG_MODE=true
}

# Keep the secrets out of swap, core dumps and of other users' reach.
harden_environment() {
  umask 077
  ulimit -c 0 2>/dev/null || true
  set +o history 2>/dev/null || true
  export LC_ALL="${CC_LOCALE:-C.UTF-8}"
  # Only the English locale is used during the setup, a different keyboard
  # layout would change the (not echoed) passwords.
  unset LANG LANGUAGE
}

cleanup() {
  local rc=$?
  stop_monitor
  terminal_echo on
  if [[ -n $SECURE_DIR && -d $SECURE_DIR ]]; then
    find "$SECURE_DIR" -type f -exec shred --remove --zero {} + 2>/dev/null || true
    rm -rf -- "$SECURE_DIR"
  fi
  ROOT_PASSWORD="" USER_PASSWORD="" LUKS_PASSWORD=""
  ROOT_PASSWORD_HASH="" USER_PASSWORD_HASH=""
  if $DIALOG_MODE; then
    clear_terminal
  fi
  return $rc
}

on_error() {
  local line=$1
  fatal "Unexpected internal error at line $line. The system has not been modified."
}

make_secure_dir() {
  local base
  for base in /dev/shm /run /tmp; do
    [[ -d $base && -w $base ]] || continue
    SECURE_DIR=$(mktemp -d "$base/agama-cc.XXXXXXXX") || continue
    # bash implements here-documents and here-strings with a temporary file
    # (up to bash 5.0), keep those files in the directory which is shredded on
    # exit instead of /tmp - a here-document may contain a password hash
    export TMPDIR="$SECURE_DIR"
    return 0
  done
  printf 'Cannot create a temporary directory for the profile.\n' >&2
  exit 1
}

# ---------------------------------------------------------------------------
# User interface abstraction (dialog / plain line mode)
# ---------------------------------------------------------------------------

# Display a dialog which has no result on stdout (a message, a text box, a
# progress box or a yes/no question).
#
# "dialog" draws its user interface on stdout and returns the result on stderr
# (that is what run_dialog swaps below). These helpers are also called inside
# command substitutions, where stdout is a pipe: the dialog would be invisible
# and its drawing would be captured into the value of the calling function.
# Therefore the user interface is always drawn on stderr, which stays connected
# to the terminal.
show_dialog() {
  dialog --backtitle "$BACKTITLE" "$@" >&2
}

# The height for a dialog which should use the whole terminal: the terminal
# height minus DIALOG_HEIGHT_MARGIN. Prints 0 (the dialog default, auto size)
# when the terminal is too small or its size cannot be determined.
#
# The size has to be read from the terminal itself. Do not use
# "dialog --print-maxsize" here: this function is called in a command
# substitution, where its stdout is a pipe. Dialog does not see any terminal
# then and reports the terminfo default (24 lines) instead of the real size.
dialog_full_height() {
  local rows="" size

  if size=$(stty size </dev/tty 2>/dev/null); then
    rows=${size%% *}
  fi
  # terminfo as a fallback
  if [[ ! $rows =~ ^[0-9]+$ ]] && command -v tput >/dev/null 2>&1; then
    rows=$(tput lines 2>/dev/null) || rows=""
  fi

  if [[ $rows =~ ^[0-9]+$ ]] && ((rows >= MIN_TERMINAL_HEIGHT)); then
    printf '%d' "$((rows - DIALOG_HEIGHT_MARGIN))"
  else
    printf '0'
  fi
}

# Switch the terminal echo off/on. The progress box does not read the
# keyboard, so keys pressed during the installation would be echoed onto the
# screen and mess it up.
terminal_echo() {
  local mode
  case "$1" in
    off) mode="-echo" ;;
    on) mode="echo" ;;
    *) return 0 ;;
  esac

  (stty "$mode" </dev/tty) >/dev/null 2>&1 || true
}

# A terminal which cannot display the dialogs and which the monitor cannot
# control either: the escape sequences would be printed as garbage there.
dumb_terminal() {
  case "${TERM-}" in
    "" | dumb | unknown) return 0 ;;
  esac
  return 1
}

# Clear the screen, the output of the previous dialog must not stay on it while
# the installation progress is displayed.
#
# Plain ANSI sequences are used on purpose: the "clear" command needs a working
# TERM setting and fails silently without it (and then nothing is cleared).
clear_terminal() {
  dumb_terminal && return 0
  printf '\033[H\033[2J\033[3J' >&2
}

# Display a file in a pager. "less" must read the keyboard from the terminal:
# with the standard input it would consume the answers to the next questions.
page_file() {
  local file=$1

  if command -v less >/dev/null 2>&1 && (: </dev/tty) 2>/dev/null; then
    less -- "$file" </dev/tty >&2 || true
  else
    cat -- "$file" >&2
  fi
}

# Print a message on the terminal, wrapped at word boundaries. The messages
# contain one long line per paragraph, dialog wraps them to the dialog width
# and the line interface has to do the same.
print_wrapped() {
  printf '%s\n' "$1" | fold -s -w "$LINE_TEXT_WIDTH" >&2
}

# The width for a dialog which should use the whole terminal, for example the
# progress box with the log of the installation. Prints 0 (the dialog default)
# when the terminal is too narrow or its width cannot be determined.
dialog_full_width() {
  local cols="" size

  if size=$(stty size </dev/tty 2>/dev/null); then
    cols=${size##* }
  fi
  if [[ ! $cols =~ ^[0-9]+$ ]] && command -v tput >/dev/null 2>&1; then
    cols=$(tput cols 2>/dev/null) || cols=""
  fi

  if [[ $cols =~ ^[0-9]+$ ]] && ((cols >= MIN_TERMINAL_WIDTH)); then
    printf '%d' "$((cols - DIALOG_TEXT_MARGIN))"
  else
    printf '0'
  fi
}

# dialog_text_height TEXT WIDTH MARGIN
# The height of a dialog: the message lines (as they are wrapped into the given
# width) plus MARGIN for the frame and whatever the dialog draws around the
# message (an input field, buttons). Dialog computes the size itself when the
# height is zero, but for a message with more than one line it does not reserve
# enough space and the message overflows below the buttons.
dialog_text_height() {
  local text=$1 width=$2 margin=$3 lines

  lines=$(printf '%s\n' "$text" | fold -s -w "$((width - DIALOG_TEXT_MARGIN))" | wc -l)
  printf '%d' "$((lines + margin))"
}

# Run dialog and return its result on stdout, the dialog UI itself goes to the
# terminal via stderr.
run_dialog() {
  local out rc=0
  out=$(dialog --backtitle "$BACKTITLE" "$@" 3>&1 1>&2 2>&3) || rc=$?
  printf '%s' "$out"
  return "$rc"
}

# Every ui_* function accepts an optional "--size HEIGHT WIDTH" prefix, for
# example:
#
#   ui_message --size 20 70 "Title" "text"
#
# Zero (the default) lets dialog compute the size from the content. The size is
# only used by the dialog interface, the line interface ignores it. The option
# is a prefix because ui_menu takes a variable number of arguments.
#
# Sets UI_HEIGHT and UI_WIDTH, returns 0 when the prefix was present and the
# caller has to shift it away.
#   Usage:  if ui_size "$@"; then shift 3; fi
ui_size() {
  UI_HEIGHT=0
  UI_WIDTH=0

  [[ ${1-} == "--size" ]] || return 1
  [[ ${2-} =~ ^[0-9]+$ ]] && UI_HEIGHT=$2
  [[ ${3-} =~ ^[0-9]+$ ]] && UI_WIDTH=$3
  return 0
}

# ui_message [--size HEIGHT WIDTH] TITLE TEXT
ui_message() {
  if ui_size "$@"; then shift 3; fi
  local title=$1 text=$2 height=$UI_HEIGHT width=$UI_WIDTH
  if $DIALOG_MODE; then
    show_dialog --title "$title" --msgbox "$text" "$height" "$width" || true
  else
    printf '\n=== %s ===\n' "$title" >&2
    print_wrapped "$text"
    printf 'Press Enter to continue... ' >&2
    read -r _ || true
  fi
}

# ui_error [--size HEIGHT WIDTH] TEXT
ui_error() {
  if ui_size "$@"; then shift 3; fi
  local text=$1 height=$UI_HEIGHT width=$UI_WIDTH
  if $DIALOG_MODE; then
    show_dialog --title "Error" --msgbox "$text" "$height" "$width" || true
  else
    printf '\nERROR:\n' >&2
    print_wrapped "$text"
  fi
}

# ui_yesno [--size HEIGHT WIDTH] TITLE TEXT
# Returns 0 for "yes", 1 for "no".
ui_yesno() {
  if ui_size "$@"; then shift 3; fi
  local title=$1 text=$2 height=$UI_HEIGHT width=$UI_WIDTH answer
  if $DIALOG_MODE; then
    show_dialog --title "$title" --yesno "$text" "$height" "$width" && return 0
    return 1
  fi
  while true; do
    printf '\n=== %s ===\n' "$title" >&2
    print_wrapped "$text"
    printf '[y/n] ' >&2
    read -r answer || return 1
    case "${answer,,}" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
    esac
  done
}

# ui_text_file [--size HEIGHT WIDTH] TITLE FILE
ui_text_file() {
  if ui_size "$@"; then shift 3; fi
  local title=$1 file=$2 height=$UI_HEIGHT width=$UI_WIDTH

  if $DIALOG_MODE; then
    # --exit-label replaces the default "Exit" button label with "OK"
    show_dialog --title "$title" --exit-label "OK" \
      --textbox "$file" "$height" "$width" || true
  else
    page_file "$file"
  fi
}

# ui_input [--size HEIGHT WIDTH] TITLE PROMPT [DEFAULT]
# -> value on stdout, rc 1 when cancelled
ui_input() {
  if ui_size "$@"; then shift 3; fi
  local title=$1 prompt=$2 default=${3-} height=$UI_HEIGHT width=$UI_WIDTH value rc=0
  if ((height == 0)); then
    ((width > 0)) || width=$DIALOG_INPUT_WIDTH
    height=$(dialog_text_height "$prompt" "$width" "$DIALOG_INPUT_MARGIN")
  fi
  if $DIALOG_MODE; then
    value=$(run_dialog --title "$title" \
      --inputbox "$prompt" "$height" "$width" "$default") || rc=$?
    ((rc == 0)) || return 1
    printf '%s' "$value"
    return 0
  fi
  printf '\n' >&2
  print_wrapped "$prompt"
  if [[ -n $default ]]; then
    printf '[%s] > ' "$default" >&2
  else
    printf '> ' >&2
  fi
  IFS= read -r value || return 1
  [[ -n $value ]] || value=$default
  printf '%s' "$value"
}

# ui_password [--size HEIGHT WIDTH] TITLE PROMPT
# -> password on stdout, never echoed
ui_password() {
  if ui_size "$@"; then shift 3; fi
  local title=$1 prompt=$2 height=$UI_HEIGHT width=$UI_WIDTH value rc=0
  if ((height == 0)); then
    ((width > 0)) || width=$DIALOG_INPUT_WIDTH
    height=$(dialog_text_height "$prompt" "$width" "$DIALOG_INPUT_MARGIN")
  fi
  if $DIALOG_MODE; then
    value=$(run_dialog --title "$title" \
      --passwordbox "$prompt" "$height" "$width") || rc=$?
    ((rc == 0)) || return 1
    printf '%s' "$value"
    return 0
  fi
  printf '\n' >&2
  print_wrapped "$prompt"
  printf '> ' >&2
  IFS= read -rs value || return 1
  printf '\n' >&2
  printf '%s' "$value"
}

# ui_menu [--size HEIGHT WIDTH] TITLE TEXT TAG1 DESC1 [TAG2 DESC2 ...]
# -> selected tag on stdout
ui_menu() {
  if ui_size "$@"; then shift 3; fi
  local title=$1 text=$2 height=$UI_HEIGHT width=$UI_WIDTH
  shift 2
  local tag rc=0 index=1 choice menu_height=0
  if $DIALOG_MODE; then
    # the list of the items fills the box; with a zero menu height and an
    # explicit box height dialog would show only a few items
    if ((height > DIALOG_MENU_MARGIN)); then
      menu_height=$((height - DIALOG_MENU_MARGIN))
    fi
    tag=$(run_dialog --title "$title" --no-cancel \
      --menu "$text" "$height" "$width" "$menu_height" "$@") || rc=$?
    ((rc == 0)) || return 1
    printf '%s' "$tag"
    return 0
  fi

  local -a tags=() descs=()
  while (($# > 1)); do
    tags+=("$1")
    descs+=("$2")
    shift 2
  done
  while true; do
    printf '\n=== %s ===\n' "$title" >&2
    print_wrapped "$text"
    printf '\n' >&2
    for index in "${!tags[@]}"; do
      printf '  %d) %s\n' "$((index + 1))" "${descs[index]}" >&2
    done
    printf '\nSelection > ' >&2
    read -r choice || return 1
    if [[ $choice =~ ^[0-9]+$ ]] && ((choice >= 1 && choice <= ${#tags[@]})); then
      printf '%s' "${tags[choice - 1]}"
      return 0
    fi
  done
}

# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

# Report a non-recoverable error and let the user reboot, restart the
# configuration (only before the installation was started) or drop to a shell.
fatal() {
  local message=$1
  trap - ERR
  stop_monitor
  # the monitor may have been drawing on the screen
  clear_terminal
  ui_error "$message"

  # restarting the configuration is the first (and therefore the default)
  # option, it is the usual way out of an error
  local -a options=()
  if ! $INSTALLATION_STARTED; then
    options+=(restart "Restart the configuration from the beginning")
  fi
  options+=(reboot "Reboot the system")
  options+=(shell "Exit to a shell (for debugging)")

  local answer
  answer=$(ui_menu "Error" "How do you want to continue?" "${options[@]}") || answer="shell"
  case "$answer" in
    reboot) do_reboot ;;
    restart) exec "$0" "${SCRIPT_ARGS[@]}" ;;
    *) exit 1 ;;
  esac
}

do_reboot() {
  # --dry-run (and CC_NO_REBOOT=1) must never touch the running system, not
  # even by rebooting it.
  if $DRY_RUN || [[ ${CC_NO_REBOOT:-0} == "1" ]]; then
    ui_message "Reboot Skipped" "The system would be rebooted now.
No reboot is done because the tool runs with --dry-run / CC_NO_REBOOT=1."
    exit 0
  fi

  if command -v agama >/dev/null 2>&1 && $INSTALLATION_STARTED; then
    agama finish >/dev/null 2>&1 || systemctl reboot || reboot
  else
    systemctl reboot || reboot
  fi
  exit 0
}

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

check_prerequisites() {
  local -a missing=()
  local tool
  for tool in jq openssl curl lsblk agama cracklib-check; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  $DIALOG_MODE && ! command -v dialog >/dev/null 2>&1 && missing+=("dialog")

  if ((${#missing[@]} > 0)); then
    printf 'Required tools are missing: %s\n' "${missing[*]}" >&2
    exit 1
  fi

  if [[ ! -r $TEMPLATE ]]; then
    printf 'The JSON template is not readable: %s\n' "$TEMPLATE" >&2
    printf 'Install it to %s or pass it with --template.\n' "$SYSTEM_TEMPLATE" >&2
    exit 1
  fi
  if ! jq -e . "$TEMPLATE" >/dev/null 2>&1; then
    printf 'The JSON template is not valid JSON: %s\n' "$TEMPLATE" >&2
    exit 1
  fi
}

# An RMT server configured on the boot command line
# ("inst.register_url=<URL>") registers the system without a registration
# code, Agama reads the option itself.
detect_rmt_url() {
  local -a options=()
  local option

  RMT_URL=""
  [[ -r $CMDLINE_FILE ]] || return 0
  read -ra options <"$CMDLINE_FILE" || return 0

  for option in "${options[@]}"; do
    case "$option" in
      "$RMT_URL_OPTION="?*) RMT_URL="${option#"$RMT_URL_OPTION"=}" ;;
    esac
  done
}

# Without the local package repository on the installation medium the packages
# can only come from the SCC or from an RMT server, so the system must be
# registered.
detect_registration_requirement() {
  detect_rmt_url

  if [[ -d $LOCAL_REPO_DIR ]]; then
    REGISTRATION_REQUIRED=false
  else
    REGISTRATION_REQUIRED=true
  fi
}

# The RMT URL as it may be displayed, a user name or a password possibly
# embedded in the URL must not be shown.
safe_rmt_url() {
  local url=$1
  if [[ $url =~ ^([A-Za-z][A-Za-z0-9+.-]*://)[^/@]*@(.*)$ ]]; then
    printf '%s%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  else
    printf '%s' "$url"
  fi
}

# ---------------------------------------------------------------------------
# Agama REST API
# ---------------------------------------------------------------------------

# Write the API token into a curl configuration file, the token must never
# appear on a command line where any user could read it from /proc.
prepare_api_auth() {
  local token

  [[ -z $API_CONF ]] || return 0

  [[ -r $AGAMA_TOKEN_FILE ]] || return 1
  token=$(<"$AGAMA_TOKEN_FILE")
  token="${token//[$'\r\n']/}"
  [[ -n $token ]] || return 1

  printf 'header = "Authorization: Bearer %s"\n' "$token" >"$SECURE_DIR/curl.conf"
  API_CONF="$SECURE_DIR/curl.conf"
}

# api_get URL -> the response body on stdout
api_get() {
  prepare_api_auth || return 1
  curl -sS --max-time 15 -K "$API_CONF" "$1" 2>/dev/null
}

# The keyboard layouts offered by the installer, one "<id><TAB><description>"
# line each. Prints nothing when the list cannot be read.
keymaps() {
  local response
  response=$(api_get "$KEYMAPS_URL") || return 1
  [[ -n $response ]] || return 1
  printf '%s' "$response" |
    jq -e -r '.[] | "\(.id)\t\(.description)"' 2>/dev/null
}

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

# validate_password PASSWORD -> prints the reason on stdout when invalid
# TODO(security team): the rules below are placeholders.
validate_password() {
  local password=$1 result

  if ((${#password} < MIN_PASSWORD_LENGTH)); then
    printf 'The password must have at least %d characters.' "$MIN_PASSWORD_LENGTH"
    return 1
  fi
  if ((${#password} > MAX_PASSWORD_LENGTH)); then
    printf 'The password must not be longer than %d characters.' "$MAX_PASSWORD_LENGTH"
    return 1
  fi

  # cracklib-check echoes "<password>: <result>", strip the password prefix so
  # it cannot leak into the terminal or into a log.
  result=$(printf '%s\n' "$password" | cracklib-check 2>/dev/null) || {
    printf 'Cannot check the password strength (cracklib-check failed).'
    return 1
  }
  result=${result#"$password": }
  if [[ $result != "OK" ]]; then
    printf 'The password is not strong enough: %s' "$result"
    return 1
  fi
  return 0
}

validate_user_name() {
  local name=$1
  if [[ ! $name =~ $USER_NAME_REGEX ]]; then
    printf 'Invalid login name. Use lower case letters, digits, "_" and "-", starting with a letter or "_" (max. 32 characters).'
    return 1
  fi
  if [[ $name == "root" ]]; then
    printf 'The login name "root" is reserved for the administrator account.'
    return 1
  fi
  return 0
}

validate_full_name() {
  local name=$1
  if [[ -z $name ]]; then
    printf 'The full name must not be empty.'
    return 1
  fi
  if [[ $name == *:* || $name == *[[:cntrl:]]* ]]; then
    printf 'The full name must not contain a colon or control characters.'
    return 1
  fi
  return 0
}

validate_ntp_server() {
  local server=$1
  if [[ ! $server =~ $NTP_SERVER_REGEX ]]; then
    printf 'Invalid server address. Enter a host name or an IP address.'
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# Cryptographic operations
# ---------------------------------------------------------------------------

# hash_password PASSWORD -> SHA-512 crypt hash on stdout
hash_password() {
  local password=$1 hash
  hash=$(printf '%s' "$password" | openssl passwd -6 -stdin 2>/dev/null) || return 1
  [[ $hash == \$6\$* ]] || return 1
  printf '%s' "$hash"
}

# ---------------------------------------------------------------------------
# Workflow: welcome and license
# ---------------------------------------------------------------------------

show_welcome() {
  ui_message "$PROGRAM_NAME" "\
Welcome to the SUSE Linux Enterprise Server 16.0 installation for Common
Criteria (CC) certified and FIPS hardened systems.

This tool asks for the credentials and the target disk, then it installs
the system unattended.

WARNING: All data on the installed disk will be destroyed. Nothing is
written to the disk before you confirm the summary at the end of
the configuration."
}

# Display all the layouts in a pager, the list has hundreds of entries.
show_keymaps_list() {
  local file="$SECURE_DIR/keymaps.txt" line

  for line in "$@"; do
    printf '%-20s %s\n' "${line%%$'\t'*}" "${line#*$'\t'}"
  done >"$file"

  page_file "$file"
  rm -f -- "$file"
}

# Ask for the keyboard layout of the installed system. An empty answer (or an
# unreadable list) keeps the default, nothing is then put into the profile.
#
# The list has almost 400 entries: the dialog interface shows it in a menu, the
# line interface asks for the id and displays the list in a pager on request.
ask_keyboard() {
  local -a maps=() menu=()
  local line answer

  mapfile -t maps < <(keymaps) || true
  if ((${#maps[@]} == 0)); then
    # the installer did not provide the list, keep the default
    KEYBOARD=""
    return 0
  fi

  if $DIALOG_MODE; then
    menu=(default "Keep the default keyboard layout")
    for line in "${maps[@]}"; do
      menu+=("${line%%$'\t'*}" "${line#*$'\t'}")
    done

    answer=$(ui_menu --size "$(dialog_full_height)" 76 "Keyboard Layout" \
      "Select the keyboard layout for the current and the installed system:" "${menu[@]}") || answer="default"
    [[ $answer == "default" ]] && answer=""
    KEYBOARD="$answer"
    return 0
  fi

  while true; do
    # no default value: an empty answer always means the product default, not
    # the layout selected in a previous round
    answer=$(ui_input "Keyboard Layout" "Enter the keyboard layout id for the \
current and the installed system. Enter \"list\" to display all the available \
layouts, leave empty to keep the default:") || answer=""

    if [[ -z $answer ]]; then
      KEYBOARD=""
      return 0
    fi

    if [[ $answer == "list" ]]; then
      show_keymaps_list "${maps[@]}"
      continue
    fi

    for line in "${maps[@]}"; do
      if [[ ${line%%$'\t'*} == "$answer" ]]; then
        KEYBOARD="$answer"
        return 0
      fi
    done

    ui_error "Unknown keyboard layout \"$answer\". Enter \"list\" to display \
the available layouts."
  done
}

# The installer API reports the keymap with an optional variant in parenthesis
# ("cz(qwerty)"), localectl expects the variant separated with a dash
# ("cz-qwerty"). Ids without a variant ("cz") are used as they are.
localectl_keymap() {
  local keymap=$1

  if [[ $keymap =~ ^([^()]+)\((.+)\)$ ]]; then
    printf '%s-%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  else
    printf '%s' "$keymap"
  fi
}

# The keyboard layout active in the installer (empty when it cannot be read).
current_keymap() {
  command -v localectl >/dev/null 2>&1 || return 0
  localectl status 2>/dev/null |
    sed -n 's/^[[:space:]]*VC Keymap:[[:space:]]*//p' | head -n1
}

# Apply the selected layout to the running installer as well, so that the
# passwords are typed with the same keyboard as the installed system will use.
# A failure is not fatal, the layout stays configured for the installed system.
apply_keyboard() {
  local error target=""

  # --dry-run must not change anything on the running system
  $DRY_RUN && return 0

  if [[ -n $KEYBOARD ]]; then
    target=$KEYBOARD
  elif $KEYBOARD_APPLIED && [[ -n $KEYBOARD_ORIGINAL ]]; then
    # the user went back to the default after trying a layout, the installer
    # must not keep the tried one
    target=$KEYBOARD_ORIGINAL
  fi
  [[ -n $target ]] || return 0

  if ! command -v localectl >/dev/null 2>&1; then
    ui_error "The keyboard layout cannot be applied in the installer, \
\"localectl\" is not available. It is configured for the installed system \
only, so the passwords have to be typed with the current layout."
    return 0
  fi

  if localectl set-keymap "$(localectl_keymap "$target")" \
      >/dev/null 2>"$SECURE_DIR/localectl.err"; then
    KEYBOARD_APPLIED=true
    return 0
  fi

  error=$(tail -n 3 "$SECURE_DIR/localectl.err" 2>/dev/null)
  ui_error "Applying the keyboard layout \"$target\" in the installer failed:

$error

It is configured for the installed system only, so the passwords have to be \
typed with the current layout."
}

# Let the user try the keyboard after the layout was applied: what is typed is
# displayed, so it is visible whether the layout is the expected one. The text
# itself is not used for anything.
# Returns 0 when the layout is accepted, 1 to select a different one.
verify_keyboard() {
  local rc=0 answer height width=$DIALOG_INPUT_WIDTH
  local text="The keyboard layout \"$KEYBOARD\" is active now.

Here you can type few characters to test the keyboard layout.\
The entered text is not used for anything and is completely ignored.

Select \"Continue\" to keep this layout or \"Back\" to select a different one."

  if $DIALOG_MODE; then
    height=$(dialog_text_height "$text" "$width" "$DIALOG_INPUT_MARGIN")
    run_dialog --title "Keyboard Test" \
      --ok-label "Continue" --cancel-label "Back" \
      --inputbox "$text" "$height" "$width" >/dev/null || rc=$?
    # only "Continue" accepts the layout, "Back" and ESC select again
    ((rc == 0)) && return 0
    return 1
  fi

  printf '\n=== Keyboard Test ===\n' >&2
  print_wrapped "$text"
  printf 'Type a few characters and press Enter: ' >&2
  read -r answer || answer=""
  printf 'The installer received: %s\n' "$answer" >&2

  while true; do
    printf '[c = continue / b = back to the layout selection] ' >&2
    read -r answer || return 0
    case "${answer,,}" in
      c | continue) return 0 ;;
      b | back) return 1 ;;
    esac
  done
}

# Ask for the keyboard layout, apply it and let the user check it. The
# selection is repeated until the layout is accepted.
configure_keyboard() {
  KEYBOARD_ORIGINAL=$(current_keymap)

  while true; do
    ask_keyboard
    apply_keyboard

    # the default was kept, there is nothing to check
    [[ -n $KEYBOARD ]] || return 0

    verify_keyboard && return 0
  done
}

# Confirm the reboot after the license was rejected. "Back" is the default,
# a reboot must not happen by an accidental key press.
# Returns 0 when the reboot is confirmed, 1 to go back to the license.
# confirm_reboot TITLE TEXT
# Confirm a reboot. "Back" is the default button, the machine must not be
# rebooted by an accidental key press.
# Returns 0 when the reboot was confirmed, 1 to go back.
confirm_reboot() {
  local title=$1 text=$2 rc=0 answer

  if $DIALOG_MODE; then
    show_dialog --title "$title" \
      --yes-label "Back" --no-label "Reboot" \
      --ok-label "Back" --cancel-label "Reboot" \
      --yesno "$text" 0 0 || rc=$?

    # only "Reboot" (exit code 1) confirms the reboot, "Back" (0), ESC or an
    # error go back
    ((rc == 1)) && return 0
    return 1
  fi

  while true; do
    printf '\n=== %s ===\n' "$title" >&2
    print_wrapped "$text"
    printf '[b = back / r = reboot the system] ' >&2
    read -r answer || return 0
    case "${answer,,}" in
      r|reboot) return 0 ;;
      b|back) return 1 ;;
    esac
  done
}

confirm_license_reject() {
  confirm_reboot "License Agreement" "The license was not accepted.

The system cannot be installed without accepting the license agreement."
}

show_license() {
  if [[ ! -r $LICENSE_FILE ]]; then
    fatal "The license file is missing: $LICENSE_FILE
The installation medium seems to be incomplete."
  fi

  local rc answer
  while true; do
    if $DIALOG_MODE; then
      # The buttons are part of the license text box itself, no extra
      # confirmation dialog is needed. --ok-label is the one which counts:
      # with --extra-button the text box uses the OK button set and ignores
      # --exit-label (dialog 1.3), both are passed to stay independent of the
      # dialog version.
      rc=0
      show_dialog --title "License Agreement" \
        --ok-label "Accept license" --exit-label "Accept license" \
        --extra-button --extra-label "Reject, reboot system" \
        --textbox "$LICENSE_FILE" "$(dialog_full_height)" 80 || rc=$?

      case $rc in
        0) return 0 ;;                                # "Accept license"
        3) confirm_license_reject && break || true ;;  # "Reject, reboot system"
        *) ;;                                          # ESC: display it again
      esac
      continue
    fi

    # the line interface cannot show buttons, ask after the text
    ui_text_file "License Agreement" "$LICENSE_FILE"
    printf '\n=== License Agreement ===\nDo you accept the license agreement?\n' >&2
    printf '[y = accept license / n = reject, reboot system / b = show it again] ' >&2
    read -r answer || answer="n"
    case "${answer,,}" in
      y|yes) return 0 ;;
      n|no) confirm_license_reject && break || true ;;
    esac
  done

  do_reboot
}

# ---------------------------------------------------------------------------
# Workflow: interactive input
# ---------------------------------------------------------------------------

# ask_password TITLE PROMPT [CURRENT] -> validated password on stdout
# The password is asked twice, it is never displayed. CURRENT is the password
# entered in a previous round of the configuration: when it is not empty an
# empty answer keeps it, so the user does not have to type it again.
ask_password() {
  local title=$1 prompt=$2 current=${3-} password confirmation reason

  if [[ -n $current ]]; then
    prompt="$prompt

(leave empty to reuse the previously entered password)"
  fi

  while true; do
    password=$(ui_password "$title" "$prompt") || return 1

    # an empty answer keeps the password from the previous round
    if [[ -z $password && -n $current ]]; then
      printf '%s' "$current"
      return 0
    fi

    if ! reason=$(validate_password "$password"); then
      ui_error --size 10 60 "$reason"
      continue
    fi
    confirmation=$(ui_password "$title" \
      "Enter the same password again for confirmation:") || return 1
    if [[ $password != "$confirmation" ]]; then
      ui_error --size 6 40 "The passwords do not match, please try again."
      continue
    fi
    printf '%s' "$password"
    return 0
  done
}

# ask_validated TITLE PROMPT DEFAULT VALIDATOR -> value on stdout
ask_validated() {
  local title=$1 prompt=$2 default=$3 validator=$4 value reason
  while true; do
    value=$(ui_input "$title" "$prompt" "$default") || return 1
    if ! reason=$("$validator" "$value"); then
      ui_error "$reason"
      continue
    fi
    printf '%s' "$value"
    return 0
  done
}

ask_root_password() {
  ROOT_PASSWORD=$(ask_password "Root Password" \
    "Enter the password for the administrator
(root) account:" "$ROOT_PASSWORD") || return 1
  ROOT_PASSWORD_HASH=$(hash_password "$ROOT_PASSWORD") ||
    fatal "Cannot hash the root password, \"openssl passwd -6\" failed."
}

ask_user_account() {
  USER_NAME=$(ask_validated "First User" "Enter the login name of the first user:" \
    "$USER_NAME" validate_user_name) || return 1
  FULL_NAME=$(ask_validated "First User" "Enter the full name of the first user:" \
    "$FULL_NAME" validate_full_name) || return 1
  USER_PASSWORD=$(ask_password "First User Password" \
    "Enter the password for the user \"$USER_NAME\":" "$USER_PASSWORD") || return 1
  USER_PASSWORD_HASH=$(hash_password "$USER_PASSWORD") ||
    fatal "Cannot hash the user password, \"openssl passwd -6\" failed."
}

ask_luks_password() {
  LUKS_PASSWORD=$(ask_password "Disk Encryption" \
    "Enter the LUKS2 passphrase for the encrypted system volume.

This passphrase must be entered at every boot, it cannot
be recovered when it is lost." "$LUKS_PASSWORD") || return 1
}

ask_ntp_server() {
  NTP_FROM_DRACUT=false
  if [[ -s $DRACUT_NTP_FILE ]]; then
    # the NTP server was already configured on the boot command line
    NTP_FROM_DRACUT=true
    NTP_SERVER=""
    return 0
  fi

  local server reason
  while true; do
    server=$(ui_input "NTP Server" \
      "Enter the NTP time server address
(leave empty to use the default pool):" "$NTP_SERVER") || return 1
    if [[ -z $server ]]; then
      NTP_SERVER=""
      return 0
    fi
    if ! reason=$(validate_ntp_server "$server"); then
      ui_error "$reason"
      continue
    fi
    NTP_SERVER="$server"
    return 0
  done
}

ask_registration() {
  local prompt code

  while true; do
    if ! $REGISTRATION_REQUIRED; then
      prompt="Enter the registration code (leave empty to skip the registration):"
    elif [[ -n $RMT_URL ]]; then
      prompt="Enter the registration code.

Leave it empty to register against the RMT server configured on the \
boot command line:

  $(safe_rmt_url "$RMT_URL")"
    else
      prompt="Enter the registration code.

The installation medium does not contain a local package repository, so \
the packages must be downloaded from the registration server. The \
registration is therefore mandatory."
    fi

    code=$(ui_input "Registration" "$prompt" "$REGISTRATION_CODE") || return 1

    if [[ -n $code ]]; then
      REGISTRATION_CODE="$code"
      break
    fi

    # no code entered: that is fine unless the system must be registered and
    # no RMT server was configured on the boot command line
    if ! $REGISTRATION_REQUIRED || [[ -n $RMT_URL ]]; then
      REGISTRATION_CODE=""
      REGISTRATION_EMAIL=""
      return 0
    fi

    ui_error "A registration code is required for this installation medium.

The packages must be downloaded from the registration server because the \
local repository does not exist. Alternatively boot the installation with \
the \"$RMT_URL_OPTION=<URL>\" option to register against an RMT server \
without a code."
  done

  if [[ -z $REGISTRATION_CODE ]]; then
    REGISTRATION_EMAIL=""
    return 0
  fi
  REGISTRATION_EMAIL=$(ui_input "Registration" \
    "Enter the registration e-mail address (optional):" "$REGISTRATION_EMAIL") || return 1
}

ask_target_disk() {
  local -a disks=()
  local name size model type readonly_flag note

  # the fields are separated by \037, a tab would be collapsed by "read"
  # because tab is an IFS whitespace character
  while IFS=$'\037' read -r name type size readonly_flag model; do
    [[ $type == "disk" ]] || continue
    [[ $readonly_flag == "1" ]] && continue
    case "$name" in
      zram*|loop*|sr*|ram*) continue ;;
    esac
    # lsblk escapes the spaces in the raw output, undo it for the display
    model="${model//\\x20/ }"
    # a mounted partition usually means the installation medium
    note=""
    if lsblk -rno MOUNTPOINTS -- "/dev/$name" 2>/dev/null | grep -q '[^[:space:]]'; then
      note=" (mounted - installation medium?)"
    fi
    disks+=("/dev/$name" "${size:-?} ${model:-unknown}${note}")
  done < <(lsblk -drno NAME,TYPE,SIZE,RO,MODEL | tr ' ' '\037')

  if ((${#disks[@]} == 0)); then
    fatal "No usable disk was found in this system."
  fi

  if ((${#disks[@]} == 2)); then
    TARGET_DISK="${disks[0]}"
    TARGET_DISK_LABEL="${disks[1]}"
    return 0
  fi

  local selected
  selected=$(ui_menu "Target Disk" \
    "Select the disk for the installation. ALL DATA ON IT WILL BE LOST." "${disks[@]}") || return 1

  local index
  for index in "${!disks[@]}"; do
    if [[ ${disks[index]} == "$selected" ]]; then
      TARGET_DISK="$selected"
      TARGET_DISK_LABEL="${disks[index + 1]}"
      break
    fi
  done
}

# Ask all the questions.  Returns 1 when the user cancelled a dialog, the
# previously entered values are kept as the defaults.
collect_input() {
  ask_target_disk || return 1
  ask_root_password || return 1
  ask_user_account || return 1
  ask_luks_password || return 1
  ask_ntp_server || return 1
  ask_registration || return 1
}

# ---------------------------------------------------------------------------
# Workflow: summary
# ---------------------------------------------------------------------------

secret_state() {
  [[ -n $1 ]] && printf '[configured]' || printf '[empty]'
}

# The planned partitioning, derived from the JSON template.
# The actions Agama is going to perform on the storage devices, as computed
# for the loaded profile. Each object of the returned JSON list describes one
# action in its "text" attribute.
storage_actions() {
  local response
  response=$(api_get "$STORAGE_ACTIONS_URL") || return 1
  [[ -n $response ]] || return 1
  printf '%s' "$response" | jq -e -r '.[].text' 2>/dev/null
}

# Read the storage actions which Agama planned for the loaded profile. Without
# them the user cannot see what would be destroyed, so a failure is fatal.
# This must not run inside a command substitution, "fatal" would only end the
# subshell there.
fetch_storage_actions() {
  STORAGE_ACTIONS_TEXT=""
  # in the --dry-run mode the profile is not loaded, there is no proposal
  $DRY_RUN && return 0

  STORAGE_ACTIONS_TEXT=$(storage_actions) || fatal "Cannot read the storage actions from Agama
($STORAGE_ACTIONS_URL).

Without them it cannot be displayed which devices would be modified, so the
installation does not continue."
}

storage_proposal() {
  printf 'Target disk: %s  %s\n' "$TARGET_DISK" "$TARGET_DISK_LABEL"

  if [[ -z $STORAGE_ACTIONS_TEXT ]]; then
    # only reachable with --dry-run, Agama is not contacted in that mode
    printf 'Storage actions: not available, Agama is not contacted with --dry-run.\n'
    return 0
  fi

  printf 'WARNING: ALL DATA data on the target disk will be DESTROYED!!\n\n'
  printf 'Storage actions planned by the installer:\n'
  printf '%s\n' "$STORAGE_ACTIONS_TEXT" | sed -e 's/^/  /'
}

build_summary() {
  local ntp_state registration_note="" registration_server=""
  if $NTP_FROM_DRACUT; then
    ntp_state="[configured on the boot command line]"
  elif [[ -n $NTP_SERVER ]]; then
    ntp_state="$NTP_SERVER"
  else
    ntp_state="[use default pool]"
  fi

  if $REGISTRATION_REQUIRED; then
    if [[ -n $REGISTRATION_CODE ]]; then
      registration_note=" (mandatory, no local package repository)"
    else
      registration_note=" (not needed, RMT server is configured)"
    fi
  fi
  [[ -z $RMT_URL ]] || registration_server="
Registration server:  $(safe_rmt_url "$RMT_URL")"

  cat <<EOF
Keyboard layout:      ${KEYBOARD:-[default]}
Root password:        $(secret_state "$ROOT_PASSWORD")
First user login:     $USER_NAME
First user full name: $FULL_NAME
First user password:  $(secret_state "$USER_PASSWORD")
LUKS2 passphrase:     $(secret_state "$LUKS_PASSWORD")
NTP server:           $ntp_state
Registration code:    $(secret_state "$REGISTRATION_CODE")${registration_note}
Registration e-mail:  ${REGISTRATION_EMAIL:-[empty]}${registration_server}
Target disk:          $TARGET_DISK  $TARGET_DISK_LABEL
EOF
}

# The configuration summary. The text box carries the decision buttons
# itself: "Continue" (the default), "Configure again" and "Reboot". Rebooting
# has to be confirmed.
# Prints the chosen action: continue | back | reboot
confirm_summary() {
  local file="$SECURE_DIR/summary.txt" action rc

  build_summary >"$file"

  while true; do
    if $DIALOG_MODE; then
      # the third button is the help button, its exit code is 2
      rc=0
      show_dialog --title "Configuration Summary" \
        --ok-label "Continue" --exit-label "Continue" \
        --extra-button --extra-label "Configure again" \
        --help-button --help-label "Reboot" \
        --textbox "$file" 0 0 || rc=$?

      case $rc in
        0) action="continue" ;;
        3) action="back" ;;
        2) action="reboot" ;;
        *) continue ;;  # ESC or an error: display the summary again
      esac
    else
      # the line interface cannot show buttons, ask after the text
      printf '\n=== Configuration Summary ===\n' >&2
      cat -- "$file" >&2
      action=$(ui_menu "Configuration Summary" \
        "Nothing has been written to the disk yet. How do you want to continue?" \
        continue "Continue - let the installer compute the storage proposal" \
        back "Configure again (start over)" \
        reboot "Reboot without modifying the system") || action="back"
    fi

    if [[ $action == "reboot" ]]; then
      confirm_reboot "Reboot" "Nothing has been written to the disk, the system \
is not modified.

Do you really want to reboot without installing the system?" || continue
    fi

    rm -f -- "$file"
    printf '%s' "$action"
    return 0
  done
}

# The storage proposal Agama computed for the loaded profile, displayed in its
# own dialog after the configuration summary was confirmed.
# The storage proposal with the decision buttons in the text box itself:
# "Install" (the default), "Configure again" and "Reboot". Rebooting has to be
# confirmed.
# Prints the chosen action: install | back | reboot
confirm_storage_proposal() {
  local file="$SECURE_DIR/proposal.txt" action rc

  storage_proposal >"$file"

  while true; do
    if $DIALOG_MODE; then
      # the third button is the help button, its exit code is 2
      rc=0
      show_dialog --title "Storage Proposal" \
        --ok-label "Install" --exit-label "Install" \
        --extra-button --extra-label "Configure again" \
        --help-button --help-label "Reboot" \
        --textbox "$file" 0 0 || rc=$?

      case $rc in
        0) action="install" ;;
        3) action="back" ;;
        2) action="reboot" ;;
        *) continue ;;  # ESC or an error: display the proposal again
      esac
    else
      # the line interface cannot show buttons, ask after the text
      printf '\n=== Storage Proposal ===\n' >&2
      cat -- "$file" >&2
      action=$(ui_menu "Storage Proposal" \
        "This is the last step before the disk is modified. How do you want to continue?" \
        install "Start the installation now" \
        back "Configure again (start over)" \
        reboot "Reboot without modifying the system") || action="back"
    fi

    if [[ $action == "reboot" ]]; then
      confirm_reboot "Reboot" "The disk has not been modified yet, the \
installation has not started.

Do you really want to reboot without installing the system?" || continue
    fi

    rm -f -- "$file"
    printf '%s' "$action"
    return 0
  done
}

# ---------------------------------------------------------------------------
# Profile generation
# ---------------------------------------------------------------------------

# The content of the chrony configuration file for the installed system: the
# sources configured by the dracut module on the boot command line, or the
# server entered by the user. Prints nothing when there is no NTP server, then
# no file is added to the profile.
ntp_config_content() {
  if $NTP_FROM_DRACUT; then
    cat -- "$DRACUT_NTP_FILE" 2>/dev/null || true
  elif [[ -n $NTP_SERVER ]]; then
    printf 'server %s iburst\n' "$NTP_SERVER"
  fi
}

# Write a secret into the tmpfs directory without a trailing newline so that
# jq --rawfile reads the exact value.  Secrets are passed this way instead of
# via --arg or the environment to keep them out of /proc.
write_secret() {
  local file="$SECURE_DIR/$1"
  printf '%s' "$2" >"$file"
  printf '%s' "$file"
}

# Build the Agama profile from the template, print it on stdout.
build_profile() {
  local root_hash user_hash luks_pass ntp_content

  root_hash=$(write_secret root_hash "$ROOT_PASSWORD_HASH")
  user_hash=$(write_secret user_hash "$USER_PASSWORD_HASH")
  luks_pass=$(write_secret luks_pass "$LUKS_PASSWORD")

  # the NTP configuration is written as a file, not by a script
  ntp_content="$SECURE_DIR/ntp-content"
  ntp_config_content >"$ntp_content"

  jq -e \
    --rawfile root_password "$root_hash" \
    --rawfile user_password "$user_hash" \
    --rawfile luks_password "$luks_pass" \
    --rawfile ntp_content "$ntp_content" \
    --arg ntp_destination "$NTP_DESTINATION" \
    --arg ntp_permissions "$NTP_PERMISSIONS" \
    --arg keyboard "$KEYBOARD" \
    --arg user_name "$USER_NAME" \
    --arg full_name "$FULL_NAME" \
    --arg disk "$TARGET_DISK" \
    --arg registration_code "$REGISTRATION_CODE" \
    --arg registration_email "$REGISTRATION_EMAIL" \
    '
    .root.hashedPassword = true
    | .root.password = $root_password

    | .user.userName = $user_name
    | .user.fullName = $full_name
    | .user.hashedPassword = true
    | .user.password = $user_password

    # the keyboard layout, an empty value keeps the default of the product
    | if $keyboard != "" then .localization.keyboard = $keyboard else . end

    | if $registration_code != "" then .product.registrationCode = $registration_code else . end
    | if $registration_code != "" and $registration_email != ""
      then .product.registrationEmail = $registration_email else . end

    # install on the disk selected by the user
    | .storage.drives[0].search = $disk

    # the LUKS2 passphrase of the encrypted physical volume
    | .storage.drives[0].partitions |= map(
        if .encryption.luks2 then .encryption.luks2.password = $luks_password else . end
      )

    # the NTP server: a file in the installed system
    | if $ntp_content != "" then
        .files = ((.files // []) + [{
          destination: $ntp_destination,
          content: $ntp_content,
          permissions: $ntp_permissions,
          user: "root",
          group: "root"
        }])
      else . end
    ' "$TEMPLATE"
}

# Verify that the generated profile really contains the expected values.  The
# profile itself is never printed, only the result of the checks.
verify_profile() {
  local profile=$1
  local filter='
    (.product.id == "SLES")
    and (.root.hashedPassword == true) and ((.root.password | startswith("$6$")))
    and (.user.userName != "") and ((.user.password | startswith("$6$")))
    and (.storage.drives[0].search != "*")
    and ([.storage.drives[0].partitions[] | select(.encryption.luks2)
          | .encryption.luks2.password | length] | all(. > 0))
    and ((.files // []) | all((.destination | length) > 0 and (.content | length) > 0))
  '
  # a pipe, not a here-string: bash implements "<<<" with a temporary file, so
  # the profile (with the plain text LUKS passphrase) would be written to disk
  printf '%s' "$profile" | jq -e "$filter" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Installation
# ---------------------------------------------------------------------------

# "agama monitor" displays the installation progress itself. It runs directly
# in the terminal without any wrapping: redirecting its output into a file or a
# pipe does not work (it redraws a single progress line and such output is
# never flushed), and a detached process has no terminal to draw on.
#
# The screen therefore belongs to the monitor, the tool does not display
# anything while the installation is running.
start_monitor() {
  clear_terminal
  printf 'Installing the system, please wait...\n' >&2

  # The monitor writes to the standard error, that is the stream which is
  # displayed (dialog draws its interface there as well). Its standard input is
  # /dev/null: the terminal is needed for the questions of the tool and the
  # monitor does not read anything.
  agama monitor >&2 2>&1 </dev/null &
  MONITOR_PID=$!
}

# Is the monitor still running?
monitor_running() {
  [[ -n $MONITOR_PID ]] && kill -0 "$MONITOR_PID" 2>/dev/null
}

# Poll the Agama API until something happens. Nothing is displayed, the
# progress is displayed by "agama monitor" on the terminal; only when the
# monitor is not running the elapsed time is reported, so that the screen does
# not look dead.
#
#   poll_installation START DEADLINE STATUS_FILE
#     START       value of $SECONDS when the installation was started
#     DEADLINE    seconds after which the user is asked whether to keep waiting
#     STATUS_FILE gets "finished", "api_failed" or "timeout"
poll_installation() {
  local start=$1 deadline=$2 status_file=$3
  local response failures=0 elapsed
  # the first report comes with the first poll (not at zero seconds), the next
  # ones every PROGRESS_HEARTBEAT seconds - on a dumb terminal this is the only
  # sign that anything happens
  local heartbeat=$((-PROGRESS_HEARTBEAT))

  while true; do
    elapsed=$((SECONDS - start))

    # the monitor displays nothing on a dumb terminal (a serial line without a
    # terminal emulation), report the elapsed time even when it is running
    if ((elapsed > 0)) && { dumb_terminal || ! monitor_running; } &&
        ((elapsed - heartbeat >= PROGRESS_HEARTBEAT)); then
      printf 'still installing, elapsed time: %dm %02ds\n' \
        "$((elapsed / 60))" "$((elapsed % 60))" >&2
      heartbeat=$elapsed
    fi

    if response=$(api_get "$API_URL"); then
      failures=0
      if printf '%s' "$response" |
          jq -e "(.phase == $FINISH_PHASE) and (.isBusy == false)" >/dev/null 2>&1; then
        printf 'finished' >"$status_file"
        return 0
      fi
    else
      failures=$((failures + 1))
      if ((failures > MAX_API_FAILURES)); then
        printf 'api_failed' >"$status_file"
        return 0
      fi
    fi

    if ((elapsed > deadline)); then
      printf 'timeout' >"$status_file"
      return 0
    fi

    sleep "$POLL_INTERVAL"
  done
}


stop_monitor() {
  [[ -n $MONITOR_PID ]] || return 0
  kill -TERM "$MONITOR_PID" 2>/dev/null || true
  wait "$MONITOR_PID" 2>/dev/null || true
  MONITOR_PID=""
}

# Load the profile into Agama. Agama computes the storage proposal from it, so
# this must happen before the summary is displayed. Nothing is written to the
# disk yet, that starts with "agama install".
load_profile() {
  local profile=$1 rc
  local status_file="$SECURE_DIR/load.status"

  $DRY_RUN && return 0

  : >"$status_file"

  # Loading the profile takes a while, Agama also computes the storage
  # proposal from it. A progress box stays on the screen as long as the pipe
  # is open (an infobox would disappear as soon as dialog exited).
  {
		echo "Loading the user provided data."
    if printf '%s' "$profile" | agama config load >/dev/null 2>"$SECURE_DIR/agama.err"; then
      printf '0' >"$status_file"
    else
      printf '1' >"$status_file"
    fi
  } | if $DIALOG_MODE; then
        show_dialog --title "Initializing" \
          --progressbox "Initializing the installer, please wait..." 6 "$DIALOG_INPUT_WIDTH"
      else
        cat >&2
      fi

  rc=$(<"$status_file")
  if [[ $rc != "0" ]]; then
    fatal "Loading the installation profile failed:

$(tail -n 5 "$SECURE_DIR/agama.err" 2>/dev/null)"
  fi
}

# Start the installation of the already loaded profile.
start_installation() {
  if $DRY_RUN; then
    ui_message "Dry Run" "The profile was generated and validated successfully.
Agama was not contacted and no changes were made to the system (--dry-run)."
    return 1
  fi

  INSTALLATION_STARTED=true

  # the monitor is started first so that the progress is on the screen from
  # the very beginning ("agama install" only triggers the installation and
  # returns immediately)
  start_monitor

  if ! agama install >/dev/null 2>"$SECURE_DIR/agama.err"; then
    fatal "Starting the installation failed:

$(tail -n 5 "$SECURE_DIR/agama.err" 2>/dev/null)"
  fi

  return 0
}

# A long running installation is not necessarily a failure, it can just be a
# slow network or a slow disk.  Let the user decide whether to keep waiting;
# an unanswered question keeps the installation running so that an unattended
# installation is never aborted by accident.
# Returns 0 to keep waiting, 1 when the user wants to abort.
ask_continue_waiting() {
  local elapsed=$1 rc=0 answer=""
  local text="The installation is still running after $((elapsed / 3600))h $(((elapsed % 3600) / 60))m.

This can be normal when the packages are installed over a slow network
connection. Aborting now leaves an incomplete system on the disk.

Do you want to keep waiting?"

  if $DIALOG_MODE; then
    show_dialog --title "Installation Takes Long" \
      --timeout "$WAIT_QUESTION_TIMEOUT" --yes-label "Keep Waiting" --no-label "Abort" \
      --yesno "$text" 0 0 || rc=$?
    # only an explicit "Abort" (exit code 1) stops the waiting, a timeout or
    # ESC keeps the installation running
    ((rc == 1)) && return 1
    return 0
  fi

  printf '\n=== Installation Takes Long ===\n%s\n[Enter = keep waiting, "n" = abort] ' "$text" >&2
  read -r -t "$WAIT_QUESTION_TIMEOUT" answer || answer=""
  case "${answer,,}" in
    n|no|abort) return 1 ;;
  esac
  return 0
}

# Poll the Agama REST API until the installation is finished.
wait_for_installation() {
  local start deadline status elapsed
  local status_file="$SECURE_DIR/wait.status"

  prepare_api_auth ||
    fatal "The Agama API token in $AGAMA_TOKEN_FILE is missing or empty."

  # the monitor does not read the keyboard, pressed keys would be echoed over
  # its output
  terminal_echo off

  start=$SECONDS
  deadline=$MAX_INSTALL_SECONDS

  while true; do
    : >"$status_file"
    poll_installation "$start" "$deadline" "$status_file"

    status=$(<"$status_file")
    elapsed=$((SECONDS - start))
    terminal_echo on

    case "$status" in
      finished)
        return 0
        ;;
      api_failed)
        # the monitor would draw over the dialog
        stop_monitor
        clear_terminal
        fatal "The Agama API at $API_URL is not responding, the installation status is unknown."
        ;;
      timeout)
        stop_monitor
        clear_terminal
        if ask_continue_waiting "$elapsed"; then
          deadline=$((deadline + MAX_INSTALL_SECONDS))
          start_monitor
          terminal_echo off
        else
          fatal "The installation did not finish within $((elapsed / 3600)) hours and was
aborted on user request. The target disk contains an incomplete system."
        fi
        ;;
      *)
        stop_monitor
        clear_terminal
        fatal "Monitoring the installation failed unexpectedly."
        ;;
    esac
  done
}

# The reboot after the installation is always confirmed explicitly, there is
# no timeout: the medium may have to be removed first, so the machine must not
# reboot on its own.
finish_installation() {
  stop_monitor
  clear_terminal

  local text="The installation finished successfully.

Remove the installation medium and reboot the system."
  local rc=0 answer=""

  if $DIALOG_MODE; then
    show_dialog --title "Installation Finished" \
      --yes-label "Reboot" --no-label "Do not reboot" \
      --ok-label "Reboot" --cancel-label "Do not reboot" \
      --yesno "$text

Reboot now?" 0 0 || rc=$?

    # only the "Reboot" button reboots, "Do not reboot" and ESC leave the
    # machine running
    if ((rc != 0)); then
      ui_message --size 5 65 "Installation Finished" "Reboot the system manually to start the installed system."
      return 0
    fi
  else
    printf '\n=== Installation Finished ===\n' >&2
    print_wrapped "$text"
    while true; do
      printf 'Reboot the system now? [y = reboot / n = do not reboot] ' >&2
      read -r answer || answer="n"
      case "${answer,,}" in
        y|yes) break ;;
        n|no)
          printf '\nReboot the system manually to start the installed system.\n' >&2
          return 0
          ;;
      esac
    done
  fi

  if [[ ${CC_NO_REBOOT:-0} == "1" ]]; then
    ui_message "Reboot Skipped" "The system would be rebooted now (CC_NO_REBOOT=1)."
    return 0
  fi

  if ! agama finish >/dev/null 2>&1; then
    ui_error "Installer reboot failed, rebooting the system directly."
    systemctl reboot || reboot
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  SCRIPT_ARGS=("$@")
  parse_arguments "$@"
  harden_environment
  check_prerequisites
  make_secure_dir

  trap cleanup EXIT
  trap 'on_error $LINENO' ERR
  trap 'exit 130' INT TERM

  detect_registration_requirement

  show_welcome
  configure_keyboard
  show_license

  local action="" profile=""
  while [[ $action != "install" ]]; do
    if ! collect_input; then
      # a dialog was cancelled, offer to start over or to reboot
      if ui_yesno --size 7 45 "Cancelled" "The configuration was cancelled.
Do you want to start over?"; then
        continue
      fi
      do_reboot
    fi

    # first gate: the entered configuration, Agama is not contacted yet
    action=$(confirm_summary) || action="back"
    case "$action" in
      reboot) do_reboot ;;
      back) continue ;;
    esac

    profile=$(build_profile) || fatal "Generating the installation profile failed."
    verify_profile "$profile" ||
      fatal "The generated installation profile is incomplete or invalid."

    # hand the profile over to Agama, it computes the storage proposal from it;
    # this still does not touch the disk
    load_profile "$profile"
    fetch_storage_actions

    # second gate: what Agama is really going to do with the disks
    action=$(confirm_storage_proposal) || action="back"
    case "$action" in
      reboot) do_reboot ;;
      back) continue ;;
    esac
  done

  if ! start_installation; then
    profile=""
    exit 0   # dry run
  fi
  profile=""

  wait_for_installation
  finish_installation
}

# allow sourcing the script in tests without running the workflow
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  main "$@"
fi
