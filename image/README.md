# Live ISO

## Contents

This directory contains a set of files that are used to build the Live ISO image.

* The `_service` file defines the OBS services to fetch the required files from the Git repository.
* The `_constraints` file tells OBS to build the image on the hosts with enough resources.
* `d-installer-live.kiwi` (and `config.sh`) are used by [kiwi](https://github.com/OSInside/kiwi/) to
  build the image.
* The `extrastuff` directory contains a set of configuration files that are placed in the ISO but
  not taken from any RPM package.

## Configuration files

* SSH connectivity: `/etc/ssh/sshd_config.d/10_root_login.conf` allows root login
* Autologin and gfx startup:
  - `/etc/systemd/system/x11-autologin.service` uses startx to start an x11 session.
  - startx runs icewm via `/root/.xinitrc`.
  - icewm autostarts Firefox via `/root/.icewm/startup`.
  - icewm uses usual YaST2 installation config from `/etc/icewm/preferences.yast2`.
* Firefox profile is defined in `/root/.mozilla/firefox/profile`.

## OBS services

The idea is to keep OBS sources and the Git repository in sync. So when any change is needed, it is
expected to open a pull request and rely on OBS services to sync them once they are merged.

```
osc service manualrun
osc commit -m "Describe the changes..."
```

If you need to try your changes in a temporary branch, you can adjust the `_service` file to point
to such a branch.
