#!/usr/bin/bash

# Connect to Agama's WebSocket using websocat.

TOKEN=`awk '/Authorization/{print $3}' headers.txt`
URL=$(echo $AGAMA_URL | sed -e 's/https/wss/')
websocat $URL/api/ws -k -H "Authorization: Bearer $TOKEN"

