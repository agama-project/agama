#!/usr/bin/sh

# Log into an Agama server, writing the headers for subsequent requests in
# the headers.txt file.

echo "Logging in $AGAMA_URL"
TOKEN=$(curl -k --silent "$AGAMA_URL/api/auth" -d '{"password": "linux"}' \
  -H "Content-Type: application/json" | jq .token | tr -d '"')

if [ -z "$TOKEN" ]
then
  echo "Failed to authenticate"
  exit 1
fi

echo "Content-Type: application/json" >headers.txt
printf "Authorization: Bearer " >>headers.txt
echo "$TOKEN" >>headers.txt
echo Using token "$TOKEN"
