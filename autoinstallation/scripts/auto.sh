#!/usr/bin/sh
set -ex

# Temporarily skip the AutoYaST XML validation
export YAST_SKIP_XML_VALIDATION=1

if [ -z "$1" ]
then
  url=$(awk -F 'agama.auto=' '{sub(/ .*$/, "", $2); print $2}' < /proc/cmdline)
else
  url="$1"
fi

if [ -z "$url" ]
then
  echo "no autoinstallation profile"
  exit 0
fi

echo "Using the profile at $url"

tmpdir=$(mktemp --directory --suffix "-agama")
echo "working on $tmpdir"

case "$url" in
*.jsonnet )
    /usr/bin/agama profile download "$url" > "${tmpdir}/profile.jsonnet"
    /usr/bin/agama profile evaluate "${tmpdir}/profile.jsonnet" > "${tmpdir}/profile.json"
    /usr/bin/agama profile validate "${tmpdir}/profile.json" || echo "Validation failed"
    /usr/bin/agama config load "${tmpdir}/profile.json"
    /usr/bin/agama install;;
*.json )
    /usr/bin/agama profile download "$url" > "${tmpdir}/profile.json"
    /usr/bin/agama profile validate "${tmpdir}/profile.json" || echo "Validation failed"
    /usr/bin/agama config load "${tmpdir}/profile.json"
    /usr/bin/agama install;;
*.sh )
    /usr/bin/agama profile download "$url" > "${tmpdir}/profile.sh"
    exec $SHELL "/${tmpdir}/profile.sh";;
*)
    echo "Unrecognized suffix ${url}"
    exit 1
esac

rm -r "$tmpdir"
