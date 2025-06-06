#!/bin/bash
# module-setup.sh for Agama Driver Updates

# called by dracut
check() {
  return 0
}

# called by dracut
depends() {
  echo network url-lib dmsquash-live img-lib bash
  return 0
}

installkernel() {
  return 0
}

# called by dracut
install() {
  inst_hook cmdline 99 "$moddir/agama-dud-parser.sh"
  inst_hook initqueue/online 99 "$moddir/agama-dud-apply.sh"

  dracut_need_initqueue
}
