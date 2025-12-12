#!/usr/bin/bash

# Return the users' configuration.

curl -k --silent -H @headers.txt -X GET $AGAMA_URL/api/v2/config | jq
