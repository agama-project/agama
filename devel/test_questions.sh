#!/bin/bash

# This script generates sample questions using `agama questions ask`
# mirroring the exact classes, fields, actions, and data structures
# found in the Rust and Ruby source code.

if ! command -v agama &> /dev/null; then
    echo "Warning: 'agama' command not found."
    echo "You might need to build the project first or run this inside an environment with agama installed."
    echo "Trying to continue anyway... you might see errors if it is completely missing."
    echo
fi

echo "1) Real scenario: 'load.retry' (agama-autoinstall/src/questions.rs)"
cat << 'EOF' | agama questions ask
{
  "text": "Could not fetch the profile from http://192.168.1.100/autoinst.xml",
  "class": "load.retry",
  "field": { "type": "string"},
  "actions": [
    { "id": "retry", "label": "Retry" },
    { "id": "abort", "label": "Abort" }
  ],
  "data": {
    "error": "Failed to connect to 192.168.1.100 port 80: Connection timed ou\n\nasdjsakdjsakdjasld\n\nasdkhsadlkasjda\nskjdlsajdsalkda\nskjdsaldkasjdlkjsalda\n\njdsadsalk",
    "originalValue": "http://192.168.1.100/autoinst.xml"
  }
}
EOF
echo ""

echo "2) Real scenario: 'write_script_failed' (agama-files/src/service.rs)"
cat << 'EOF' | agama questions ask
{
  "text": "Cannot write script to /mnt/scripts/post-install.sh. Ignore?",
  "class": "write_script_failed",
  "actions": [
    { "id": "yes", "label": "Yes" },
    { "id": "no", "label": "No" }
  ],
  "data": {
    "path": "/mnt/scripts/post-install.sh",
    "error": "Permission denied (os error 13)"
  }
}
EOF
echo ""

echo "3) Real scenario: 'software.import_gpg' (agama-software/src/callbacks/security.rs)"
cat << 'EOF' | agama questions ask
{
  "text": "Import the GPG key?",
  "class": "software.import_gpg",
  "actions": [
    { "id": "yes", "label": "Yes" },
    { "id": "no", "label": "No" }
  ],
  "data": {
    "name": "openSUSE Project Signing Key",
    "key_id": "0x12345678",
    "fingerprint": "22C0 7BA5 3417 8CD0 2EFE  22AA B88B 2FD4 3DBD C284"
  }
}
EOF
echo ""

echo "4) Real scenario: 'storage.commit_error' (service/lib/agama/storage/callbacks/commit_error.rb)"
cat << 'EOF' | agama questions ask
{
  "text": "There was an error performing the following action: format /dev/sda1. Do you want to continue with the rest of storage actions?",
  "class": "storage.commit_error",
  "actions": [
    { "id": "yes", "label": "Yes" },
    { "id": "no", "label": "No" }
  ],
  "data": {
    "details": "mkfs.ext4 failed with exit code 1.\nOutput: \n/dev/sda1 is apparently in use by the system; will not make a filesystem here!"
  }
}
EOF
echo ""

echo "5) Real scenario: 'autoyast.password' (service/lib/agama/autoyast/report_patching.rb)"
cat << 'EOF' | agama questions ask
{
  "text": "Please enter the password for the encrypted profile:",
  "class": "autoyast.password",
  "field": { "type": "password"},
  "actions": [
    { "id": "ok", "label": "Ok" },
    { "id": "cancel", "label": "Cancel" }
  ],
  "data": {}
}
EOF
echo ""

echo "6) Real scenario: 'registration.certificate' (agama-security/src/service.rs)"
cat << 'EOF' | agama questions ask
{
  "text": "Do you trust the certificate provided by the registration server?",
  "class": "registration.certificate",
  "actions": [
    { "id": "yes", "label": "Yes" },
    { "id": "no", "label": "No" }
  ],
  "data": {
    "certificate": "-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIU...\n-----END CERTIFICATE-----"
  }
}
EOF
echo ""

echo "7) Real scenario: 'storage.luks_activation' (service/lib/agama/storage/callbacks/activate_luks.rb)"
cat << 'EOF' | agama questions ask
{
  "text": "The device /dev/nvme0n1p3 encrypted_root (500 GiB) is encrypted.",
  "class": "storage.luks_activation",
  "field": { "type": "password"},
  "actions": [
    { "id": "skip", "label": "Skip" },
    { "id": "decrypt", "label": "Decrypt" }
  ],
  "data": {
    "device": "/dev/nvme0n1p3",
    "label": "encrypted_root",
    "size": "500 GiB",
    "attempt": "1"
  }
}
EOF
echo ""

echo "All tests spawned! Check the monitor UI to review them."
