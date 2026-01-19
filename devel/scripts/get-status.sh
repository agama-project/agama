#!/usr/bin/bash

# Retrieves the installer status (stage and progress).

curl -k --silent -H @headers.txt -X GET $AGAMA_URL/api/v2/status | jq
