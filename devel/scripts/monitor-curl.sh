#!/usr/bin/bash

# Connect to Agama's WebSocket using curl.
#
curl \
  --insecure \
  --http1.1 \
  --include \
  --no-buffer \
  --header @headers.txt \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  --header "Sec-WebSocket-Key: testing" \
  --header "Sec-WebSocket-Version: 13" \
  --output - \
  $AGAMA_URL/api/ws
