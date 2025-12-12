#!/usr/bin/bash

# Return the full (extended) configuration.

curl -k --silent -H @headers.txt -X GET $AGAMA_URL/api/v2/extended_config | jq
