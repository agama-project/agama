#!/usr/bin/bash

# Starts the installation process.

curl -k --silent -H @headers.txt -X POST $AGAMA_URL/api/v2/action -d '"install"'
