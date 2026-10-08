#!/bin/bash
#
# Runs the network scenarios on a live Agama system.
#
# Every step is loaded with "agama config load", and the network proposal is compared with the
# expectations of the step (see README.md). The responses of the API after each step are saved in
# the output/ directory of the scenario, which is emptied when the scenario runs.
#
#   ./run.sh                     # all the scenarios, old/ first
#   ./run.sh new/07 old/04-ha    # only the scenarios whose path contains any of the given texts
#
# Environment:
#
#   ETH0, ETH1   NICs to use instead of eth0 and eth1 (default: eth0 and eth1). Use spare NICs:
#                their connections are deleted.
#   AGAMA_HOST   Agama server (default: http://localhost). The errors logged by the network
#                service are only checked for a local server.
#   RESET=0      Do not delete the connections created by the scenarios. By default, the
#                connections in the system when the script starts are kept, except the ones on
#                ETH0 / ETH1 or named like the ones of the scenarios, and any other connection is
#                deleted before and after each scenario.
#   SAVE=0       Do not save the responses of the API.
#   SAVE_FULL=1  Save the whole responses instead of their network connections.
#
# It needs agama, curl and jq, and root to read the Agama logs.

set -u

DIR=$(cd "$(dirname "$0")" && pwd)
ETH0=${ETH0:-eth0}
ETH1=${ETH1:-eth1}
AGAMA_HOST=${AGAMA_HOST:-http://localhost}
RESET=${RESET:-1}
SAVE=${SAVE:-1}
SAVE_FULL=${SAVE_FULL:-0}
TMP=$(mktemp -d)
BASELINE="[]"

if [ -t 1 ]; then
  GREEN=$'\e[32m' RED=$'\e[31m' YELLOW=$'\e[33m' BOLD=$'\e[1m' DIM=$'\e[2m' RESET_COLOR=$'\e[0m'
else
  GREEN="" RED="" YELLOW="" BOLD="" DIM="" RESET_COLOR=""
fi

for tool in agama curl jq; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 2; }
done

# Runs the Agama CLI against the server to test.
cli() {
  agama --host "$AGAMA_HOST" --insecure "$@"
}

case "$AGAMA_HOST" in
  *://localhost | *://localhost/ | *://127.0.0.1* | *://\[::1\]* | localhost) LOCAL=1 ;;
  *) LOCAL=0 ;;
esac

TOKEN=$(cli auth show 2>/dev/null || cat /run/agama/token 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "Cannot get an Agama token: run 'agama auth login' or run it as root" >&2
  exit 2
fi

CHECKS=0
FAILURES=()
STEPS=0

ok() { CHECKS=$((CHECKS + 1)); echo "      ${GREEN}✓${RESET_COLOR} $1"; }
fail() { CHECKS=$((CHECKS + 1)); echo "      ${RED}✗${RESET_COLOR} $1"; FAILURES+=("$CONTEXT: $1"); }
skip() { echo "      ${YELLOW}?${RESET_COLOR} $1"; }

# Replaces eth0 and eth1 with the NICs to use.
nics() {
  sed -e "s/\beth0\b/$ETH0/g" -e "s/\beth1\b/$ETH1/g"
}

# Gets the given endpoint of the API.
api() {
  curl -sk -H "Authorization: Bearer $TOKEN" "$AGAMA_HOST/api/$1"
}

proposal() {
  api proposal | jq '.network.connections // []'
}

# Saves the responses of the API after a step, along with the loaded profile and the output of
# "agama config load".
#
# * $1: output directory of the scenario.
# * $2: name of the step (its profile without the extension).
# * $3: output of "agama config load".
# * $4: network error logged by Agama, if any.
save_step() {
  local out=$1 name=$2 endpoint filter=".network.connections"
  [ "$SAVE_FULL" = "1" ] && filter="."
  mkdir -p "$out"
  cp "$TMP/$name.json" "$out/$name.profile.json"
  printf '%s\n' "$3" ${4:+"$4"} >"$out/$name.load.log"
  for endpoint in config extended_config proposal system; do
    api "$endpoint" | jq "$filter" >"$out/$name.$endpoint.json" 2>/dev/null ||
      echo "Could not get /api/$endpoint" >"$out/$name.$endpoint.json"
  done
}

# The connections of the proposal, ports included, by ID: { id: { controller, fields } }.
JQ_FLATTEN='
  def flat(ctl): .[] | . as $c | ($c.id // $c.interface) as $id
    | ({key: $id, value: {controller: ctl, fields: $c}}),
      ([($c.bond.portConnections // [])[], ($c.bridge.portConnections // [])[]]
        | map(select(type == "object")) | flat($id));
  [flat(null)] | from_entries | with_entries(select(.value.fields.status != "removed"))
'

# Finds a connection by ID or, as a port given by name takes over the connection bound to that
# interface, by interface name.
JQ_LOOKUP='
  def lookup($conns; $id):
    $conns[$id] // ([$conns | to_entries[] | select(.value.fields.interface == $id) | .value] | first);
'

# Prints one "OK<tab>text" or "FAIL<tab>text" line per check.
JQ_COMPARE="$JQ_LOOKUP"'
  ($actual | '"$JQ_FLATTEN"') as $conns
  | $expect | to_entries[] | .key as $id | .value as $exp
  | lookup($conns; $id) as $conn
  | ($conn.fields.id // $id) as $name
  | (if $name == $id then $id else "\($id) (\($name))" end) as $label
  | if $exp.removed == true then
      if $conn == null then "OK\t\($id): removed"
      else "FAIL\t\($label): expected to be removed, but it is there" end
    elif $conn == null then "FAIL\t\($id): expected, but it is not there"
    else
      [ $exp | to_entries[] | .key as $k | .value as $v
        | (if $k == "controller" then $conn.controller else $conn.fields[$k] end) as $got
        | if $got == $v then {ok: true, text: "\($k)=\($v | tojson)"}
          else {ok: false, text: "\($k): expected \($v | tojson), got \($got | tojson)"} end ]
      | if all(.ok) then "OK\t\($label): \(map(.text) | join(", "))"
        else (.[] | select(.ok | not) | "FAIL\t\($label): \(.text)") end
    end
'

# Prints the connections of the system, ports included: [{ id, interface }].
system_connections() {
  api system | jq '.network.connections // [] | '"$JQ_FLATTEN"' | [to_entries[] | {id: .key, interface: .value.fields.interface}]'
}

# Records the connections to keep: the ones in the system when the script starts, except the
# ones on ETH0 / ETH1 or named like the connections of the scenarios (left by a previous run).
take_baseline() {
  local names
  names=$(for dir in "${scenarios[@]}"; do
    jq '[.steps[].expect.connections // {} | keys[]]' "$dir/scenario.json"
  done | jq -s 'add | unique' | nics)
  BASELINE=$(system_connections | jq --argjson names "$names" --arg eth0 "$ETH0" --arg eth1 "$ETH1" '
    [.[] | select(.interface != $eth0 and .interface != $eth1)
      | select(.id as $id | $names | index($id) | not)
      | select(.interface == null or (.interface as $i | $names | index($i) | not))
      | .id] | unique')
  echo "Keeping the connections that are not part of the tests: $(jq -r 'join(", ") | if . == "" then "none" else . end' <<<"$BASELINE")"
}

# Prints the connections of the system that are not in the baseline: [id].
leftovers() {
  system_connections | jq --argjson keep "$BASELINE" '[.[].id | select(. as $id | $keep | index($id) | not)] | unique'
}

# Deletes the connections of the system that are not in the baseline.
#
# * $1: when it happens, for the report.
clean_up() {
  local ids
  ids=$(leftovers)
  [ "$(jq length <<<"$ids")" -gt 0 ] || return 0
  echo "  ${DIM}$1: deleting $(jq -r 'join(", ")' <<<"$ids")${RESET_COLOR}"
  jq '{network: {connections: map({id: ., status: "removed"})}}' <<<"$ids" >"$TMP/reset.json"
  cli config load "$TMP/reset.json" >/dev/null 2>&1
  ids=$(leftovers | jq -r 'join(", ")')
  [ -z "$ids" ] || echo "  ${YELLOW}$1: could not delete $ids${RESET_COLOR}"
}

on_exit() {
  [ "$RESET" = "0" ] || [ -z "${CLEAN_ON_EXIT:-}" ] || clean_up "Exiting"
  rm -rf "$TMP"
}

# Prints the network error logged since the given time, if any.
logged_error() {
  journalctl -u agama-web-server --since "$1" -o cat 2>/dev/null |
    grep -m1 "Failed to update the network configuration"
}

run_step() {
  local dir=$1 index=$2 total=$3 step profile expect_schema expect_error since output rc error
  step=$(jq ".steps[$index]" "$dir/scenario.json")
  profile=$(jq -r '.profile' <<<"$step")
  expect_schema=$(jq -r '.expect.schema // "valid"' <<<"$step")
  expect_error=$(jq -r '.expect.error // empty' <<<"$step")
  CONTEXT="${dir#"$DIR"/}/$profile"

  echo "  ${BOLD}[$((index + 1))/$total] $profile${RESET_COLOR}: $(jq -r '.description' <<<"$step")"
  nics <"$dir/$profile" >"$TMP/$profile"

  since=$(date '+%Y-%m-%d %H:%M:%S')
  output=$(cli config load "$TMP/$profile" 2>&1)
  rc=$?
  error=""

  if [ "$expect_schema" = "invalid" ]; then
    if [ $rc -ne 0 ]; then
      ok "rejected by agama config load: $(head -n1 <<<"$output")"
    else
      fail "accepted by agama config load, but the schema should reject it"
    fi
  elif [ $rc -ne 0 ]; then
    fail "agama config load failed: $(head -n1 <<<"$output")"
  else
    sleep 1
    error=$(logged_error "$since")
    if [ "$LOCAL" = "0" ]; then
      skip "network: the logs of a remote server cannot be checked"
    elif ! journalctl -n0 >/dev/null 2>&1; then
      skip "network: cannot read the Agama logs (not root?)"
    elif [ -n "$expect_error" ] && [ -n "$error" ]; then
      ok "network: rejected (expected $expect_error): ${error#*configuration: }"
    elif [ -n "$expect_error" ]; then
      fail "network: applied, but $expect_error was expected"
    elif [ -n "$error" ]; then
      fail "network: rejected: ${error#*configuration: }"
    else
      ok "network: applied"
    fi
  fi

  jq -n -r --argjson actual "$(proposal)" --argjson expect "$(jq '.expect.connections // {}' <<<"$step" | nics)" \
    "$JQ_COMPARE" | while IFS=$'\t' read -r result text; do
    if [ "$result" = "OK" ]; then
      echo "      ${GREEN}✓${RESET_COLOR} $text"
    else
      echo "      ${RED}✗${RESET_COLOR} $text"
    fi
  done >"$TMP/checks"
  cat "$TMP/checks"
  CHECKS=$((CHECKS + $(wc -l <"$TMP/checks")))
  while read -r line; do
    FAILURES+=("$CONTEXT: ${line#*✗* }")
  done < <(grep "✗" "$TMP/checks")
  [ "$SAVE" = "0" ] || save_step "$dir/output" "${profile%.json}" "$output" "$error"
  STEPS=$((STEPS + 1))
}

scenarios=()
for format in old new; do
  for dir in "$DIR/$format"/*/; do
    dir=${dir%/}
    [ -f "$dir/scenario.json" ] || continue
    if [ $# -gt 0 ]; then
      match=0
      for filter in "$@"; do [[ "$dir" == *"$filter"* ]] && match=1; done
      [ $match -eq 1 ] || continue
    fi
    scenarios+=("$dir")
  done
done

[ ${#scenarios[@]} -gt 0 ] || { echo "No scenario matches: $*" >&2; exit 2; }

# The server reads the profile schema from /usr/share/agama/schema, so updating only its binary
# leaves a schema that rejects every profile of new/.
if [[ " ${scenarios[*]}" == *" $DIR/new/"* ]]; then
  echo '{"network": {"connections": [{"id": "bond0", "bond": {"mode": "active-backup", "portConnections": ["eth0"]}}]}}' \
    >"$TMP/schema-check.json"
  if ! output=$(cli config validate - <"$TMP/schema-check.json" 2>&1); then
    echo "${RED}The Agama server rejects portConnections, so the scenarios of new/ would fail.${RESET_COLOR}" >&2
    echo "Is its profile schema up to date? Copy rust/share/profile.schema.json to /usr/share/agama/schema/." >&2
    echo "$output" >&2
    exit 2
  fi
fi
echo "Running ${#scenarios[@]} scenarios with $ETH0 and $ETH1 on $AGAMA_HOST"

trap on_exit EXIT
trap 'exit 130' INT TERM
if [ "$RESET" != "0" ]; then
  take_baseline
  CLEAN_ON_EXIT=1
fi

for dir in "${scenarios[@]}"; do
  echo
  echo "${BOLD}▶ ${dir#"$DIR"/}: $(jq -r '.title' "$dir/scenario.json")${RESET_COLOR}"
  echo "  ${DIM}$(jq -r '.description' "$dir/scenario.json" | nics)${RESET_COLOR}"
  [ "$RESET" = "0" ] || clean_up "Before"
  [ "$SAVE" = "0" ] || rm -rf "$dir/output"
  total=$(jq '.steps | length' "$dir/scenario.json")
  for ((i = 0; i < total; i++)); do
    run_step "$dir" "$i" "$total"
  done
  [ "$RESET" = "0" ] || clean_up "After"
done

echo
[ "$SAVE" = "0" ] || echo "The responses of the API are in the output/ directory of each scenario."
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "${GREEN}${#scenarios[@]} scenarios, $STEPS steps, $CHECKS checks, all passed${RESET_COLOR}"
else
  echo "${RED}${#scenarios[@]} scenarios, $STEPS steps, $CHECKS checks, ${#FAILURES[@]} failed:${RESET_COLOR}"
  printf '  %s\n' "${FAILURES[@]}"
  exit 1
fi
