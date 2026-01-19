#!/usr/bin/bash

# Partially update the configuration. You need to pass a file containing
# the payload of the PATCH request. Check the examples/ directory for some
# inspiration.

if [ -z "$1" ]
then
  echo "You need to specify a file to load the configuration from"
  exit 1

fi

curl -k -H @headers.txt -X PATCH $AGAMA_URL/api/v2/config -d @$1
