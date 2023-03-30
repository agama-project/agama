# How to set up a backend for testing this CLI frontend

I needed a testing instance of the D-Installer backend so that this
command-line frontend has something to talk to.

## Summary

1. Take the container used for continuous integration (CI) testing of the
   backend
2. Give it a git checkout of the backend
3. Install the backend within the container
4. Copy the frontend binary into the container

## Considered Alternatives

My first plan had a different finale, 4. Make the D-Bus service visible
ouside the container, but I hit an issue with D-Bus authentication, hopefully
solvable.

Josef wanted to test against a different container ([d-installer-backend][]) but that one was a
bit old and the D-Bus API was mismatched between frontend and backend.

[d-installer-backend]: https://build.opensuse.org/package/show/YaST:Head:Containers/d-installer-backend

## Details

- Frontend: [d-installer-cli][], this repo
- Backend:  [d-installer][]

[d-installer-cli]: https://github.com/yast/d-installer-cli
[d-installer]: https://github.com/yast/d-installer

The container used is built in
[OBS YaST:Head:Containers/d-installer-testing](d-installer-testing) and
downloaded from registry.o.o specified below.

[d-installer-testing]: https://build.opensuse.org/package/show/YaST:Head:Containers/d-installer-testing

I basically picked the useful bits from the `integration-tests` part
of [d-installer/.../ci.yml][ci.yml].

[ci.yml]: https://github.com/yast/d-installer/blob/25462f57ab695d6910beb59ff0b21a7afaeda47e/.github/workflows/ci.yml


```sh
# https://build.opensuse.org/package/show/YaST:Head:Containers/d-installer-testing
CIMAGE=registry.opensuse.org/yast/head/containers/containers_tumbleweed/opensuse/dinstaller-testing:latest
# rename this if you test multiple things
CNAME=dinstaller
# the '?' here will report a shell error
# if you accidentally paste a command without setting the variable first
echo ${CNAME?}

test -f service/d-installer.gemspec || echo "You should run this from a checkout of d-installer"

# destroy the previous instance
podman stop ${CNAME?}
podman rm ${CNAME?}

mkdir -p ./mnt/log-yast2 # needed?
mkdir -p ./mnt/run-dinst # only needed for D-Bus access from outside, unused now

# Update our image
podman pull ${CIMAGE?}

podman run --name ${CNAME?} \
  --privileged --detach --ipc=host \
  -v .:/checkout -v ./mnt/run-dinst:/run/d-installer -v ./mnt/log-yast2:/var/log/YaST2 \
  ${CIMAGE?}

# shortcut for the following
CEXEC="podman exec ${CNAME?} bash -c"

${CEXEC?} "cd /checkout && ./setup-service.sh"

# Optional: explicit service start using a separate log file
${CEXEC?} "cd /checkout/service && (bundle exec bin/d-installer > service.log 2>&1 &)"

# 4. Copy the frontend
# assuming the frontend is in a sibling directory
cp ../d-installer-cli/target/debug/dinstaller-cli .
${CEXEC?} "ln -sv /checkout/dinstaller-cli /usr/bin/dinstaller-cli"

# Optional: Play!
${CEXEC?} "dinstaller-cli -f yaml config show"

# Optional: show logs of autostarted services
${CEXEC?} "journalctl --since=-5min"

# Optional: show logs of explicitly started services
${CEXEC?} "cat /checkout/service/service.log"

# Optional: Interactive shell in the container
podman exec --tty --interactive ${CNAME?} bash
```
