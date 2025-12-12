#!/usr/bin/bash

# Retrieves the list of issues.

curl -k --silent -H @headers.txt -X GET $AGAMA_URL/api/v2/issues | jq
