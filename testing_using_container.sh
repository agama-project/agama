# https://build.opensuse.org/package/show/YaST:Head:Containers/agama-testing
CIMAGE=registry.opensuse.org/yast/head/containers/containers_tumbleweed/opensuse/agama-testing:latest
# rename this if you test multiple things
CNAME=agama
# the '?' here will report a shell error
# if you accidentally paste a command without setting the variable first
echo ${CNAME?}

test -f service/agama.gemspec || echo "You should run this from a checkout of agama"

# destroy the previous instance
podman stop ${CNAME?}
podman rm ${CNAME?}

mkdir -p ./mnt/log-yast2 # needed?
mkdir -p ./mnt/run-agama # only needed for D-Bus access from outside, unused now

# Update our image
podman pull ${CIMAGE?}

podman run --name ${CNAME?} \
  --privileged --detach --ipc=host \
  -v .:/checkout -v ./mnt/run-agama:/run/agama -v ./mnt/log-yast2:/var/log/YaST2 \
  ${CIMAGE?}

# shortcut for the following
CEXEC="podman exec ${CNAME?} bash -c"

${CEXEC?} "cd /checkout && ./setup-services.sh"

# Optional: explicit service start using a separate log file
${CEXEC?} "cd /checkout/service && (bundle exec bin/agamactl > service.log 2>&1 &)"

# Now the CLI is in the same repo, just symlink it
${CEXEC?} "ln -sfv /checkout/./rust/target/debug/agama /usr/bin/agama"

# Optional: Play!
${CEXEC?} "agama -f yaml config show"

# Optional: show logs of autostarted services
${CEXEC?} "journalctl --since=-5min"

# Optional: show logs of explicitly started services
${CEXEC?} "cat /checkout/service/service.log"

# Optional: Interactive shell in the container
podman exec --tty --interactive ${CNAME?} bash
