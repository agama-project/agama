# https://build.opensuse.org/package/show/YaST:Head:Containers/agama-testing
CIMAGE=registry.opensuse.org/yast/head/containers/containers_tumbleweed/opensuse/agama-testing:latest
# rename this if you test multiple things
CNAME=agama
# the '?' here will report a shell error
# if you accidentally paste a command without setting the variable first
echo ${CNAME?}

test -f service/agama.gemspec || echo "You should run this from a checkout of agama"

# destroy the previous instance, can fail if there is no previous instance
podman stop ${CNAME?}
podman rm ${CNAME?}

# Update our image
podman pull ${CIMAGE?}

podman run --name ${CNAME?} \
  --privileged --detach --ipc=host \
  -v .:/checkout \
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
