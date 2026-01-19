#!/usr/bin/bash

# Retrieves the system information.

curl -k --silent -H @headers.txt -X GET $AGAMA_URL/api/v2/system | jq
