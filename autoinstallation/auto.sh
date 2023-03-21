#!/usr/bin/sh
set -ex

if [ -z "$1" ]
then
  url=$(awk -F 'dinst.auto=' '{sub(/ .*$/, "", $2); print $2}' < /proc/cmdline)
else
  url="$1"
fi

if [ -z "$url" ]
then
  echo "no autoinstallation profile"
  exit 0
fi

echo "Using the profile at $url"

tmpdir=$(mktemp --directory --suffix "-dinstaller")
echo "working on $tmpdir"

case "$url" in
*.jsonnet )
    /usr/bin/dinstaller profile download "$url" > "${tmpdir}/profile.jsonnet"
    /usr/bin/dinstaller profile evaluate "${tmpdir}/profile.jsonnet" > "${tmpdir}/profile.json"
    /usr/bin/dinstaller profile validate "${tmpdir}/profile.json" || echo "Validation failed"
    /usr/bin/dinstaller config load "${tmpdir}/profile.json"
    /usr/bin/dinstaller install;;
*.json )
    /usr/bin/dinstaller profile download "$url" > "${tmpdir}/profile.json"
    /usr/bin/dinstaller profile validate "${tmpdir}/profile.json" || echo "Validation failed"
    /usr/bin/dinstaller config load "${tmpdir}/profile.json"
    /usr/bin/dinstaller install;;
*.sh )
    /usr/bin/dinstaller profile download "$url" > "${tmpdir}/profile.sh"
    exec $SHELL -c "/${tmpdir}/profile.sh";;
*)
    echo "Unrecognized suffix ${url}"
    exit 1
esac

rm -r "$tmpdir"
