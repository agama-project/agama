#! /bin/sh
# Run a program in our xgettext container, building it if necessary.
# Example: run.sh build_pot agama.pot

# path to this script
DIR="$(dirname "$0")"

"$DIR"/build.sh

"$@"
