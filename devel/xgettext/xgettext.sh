#! /bin/sh

# Run xgettext from a container and pass all arguments to it.
# E.g. "./xgettext.sh --version" prints the version of the xgettext
# included in the container.

podman run -i --rm -v .:/root/run agama-xgettext "$@"
