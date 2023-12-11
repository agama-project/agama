# How to set up a backend for testing the CLI frontend

I needed a testing instance of the Agama backend so that the
Rust command-line frontend has something to talk to.

## Summary

1. Take the container used for continuous integration (CI) testing of the
   backend
2. Give it a git checkout of this repo
3. Install the backend within the container
4. Copy the frontend binary into the container

## Considered Alternatives

My first plan had a different finale, 4. Make the D-Bus service visible
ouside the container, but I hit an issue with D-Bus authentication, hopefully
solvable. (Update: `xdg-dbus-proxy` seems to work, ask mvidner about it)

Josef wanted to test against a different container (`d-installer-backend`) but that one was a
bit old and the D-Bus API was mismatched between frontend and backend.

## Details

The container used is built in
[OBS systemsmanagement:Agama:Staging/agama-testing][agama-testing] and
downloaded from registry.o.o specified below.

[agama-testing]: https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/agama-testing

I basically picked the useful bits from the `integration-tests` part
of [.github/workflows/ci.yml][ci.yml].

[ci.yml]: https://github.com/openSUSE/agama/blob/25462f57ab695d6910beb59ff0b21a7afaeda47e/.github/workflows/ci.yml


```sh
# https://build.opensuse.org/package/show/systemsmanagement:Agama:Staging/agama-testing
CIMAGE=registry.opensuse.org/systemsmanagement/agama/staging/containers/opensuse/agama-testing:latest
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
```
