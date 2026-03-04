#! /bin/sh

# use the Dockerfile relative to this script
podman build -t agama-xgettext "$(dirname "$0")"
