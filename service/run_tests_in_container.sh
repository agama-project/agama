#! /bin/bash

set -ex
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
podman create -ti --rm --entrypoint '["sh", "-c"]' --name agama_ruby_tests -v $SCRIPT_DIR/..:/checkout registry.opensuse.org/yast/head/containers_tumbleweed/yast-ruby sh
podman start agama_ruby_tests
podman exec agama_ruby_tests zypper --non-interactive install yast2-iscsi-client ruby3.2-rubygem-eventmachine
if podman exec --workdir /checkout/service agama_ruby_tests rake test:unit; then
  if [ "$KEEP_RUNNING" != "1" ]; then
    podman stop agama_ruby_test
  fi
  echo "Tests passed"
else
  echo "Tests failed"
  echo "To get into container use: podman attach agama_ruby_tests"
  echo "git checkout is located at /checkout"
  echo "To remove container use: podman rm agama_ruby_tests"
fi
