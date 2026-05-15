#! /bin/bash

set -ex
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
podman create -ti --rm --entrypoint '["sh", "-c"]' --name agama_ruby_tests -v $SCRIPT_DIR/..:/checkout registry.opensuse.org/yast/head/containers_tumbleweed/yast-ruby sh
podman start agama_ruby_tests
podman exec agama_ruby_tests zypper --non-interactive install yast2-iscsi-client yast2-bootloader ruby4.0-rubygem-eventmachine
if podman exec --workdir /checkout/service agama_ruby_tests rake test:unit; then
  if [ "$KEEP_RUNNING" != "1" ]; then
    podman stop agama_ruby_tests
  fi
  echo "Tests passed"
else
  echo "Tests failed"
  echo "To get into container use:"; echo "  podman attach agama_ruby_tests"
  echo "  cd /checkout"
  echo "To remove container use:"; echo "  podman rm agama_ruby_tests"
fi
