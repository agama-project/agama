#!/bin/bash
set -x
set -eu

# https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/agama-testing
CIMAGE=registry.opensuse.org/systemsmanagement/agama/staging/containers/opensuse/agama-testing:latest
# rename this if you test multiple things
CNAME=agama

test -f service/agama.gemspec || echo "You should run this from a checkout of agama"

# destroy the previous instance, can fail if there is no previous instance
podman stop ${CNAME?} || : no problem if there was nothing to stop
podman rm ${CNAME?} || : no problem if there was nothing to remove

# Update our image
podman pull ${CIMAGE?}

# Optionally use a git version of ruby-dbus
# because Agama pushes its limits so it's better
# to set up for easy testing
MORE_VOLUMES=()
if [ "${WITH_RUBY_DBUS-}" = 1 ]; then
  MORE_VOLUMES=(-v ../ruby-dbus:/checkout-ruby-dbus)
fi

podman run --name ${CNAME?} \
  --privileged --detach --ipc=host \
  -v .:/checkout \
  ${MORE_VOLUMES[@]} \
  -p 9090:9090 \
  ${CIMAGE?}

# shortcut for the following
CEXEC="podman exec ${CNAME?} bash -c"

${CEXEC?} "cd /checkout && ./setup.sh"

# Now the CLI is in the same repo, just symlink it
${CEXEC?} "ln -sfv /checkout/./rust/target/debug/agama /usr/bin/agama"

# Manually start cockpit as socket activation does not work with port forwarding
${CEXEC?} "systemctl start cockpit"

# Optional: Interactive shell in the container
podman exec --tty --interactive ${CNAME?} bash
