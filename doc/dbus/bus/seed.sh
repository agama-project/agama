#!/bin/bash
abusctl() {
    busctl --address=unix:path=/run/agama/bus "$@"
}

# a stdio filter for XML introspection,
# to fix some less clever choices made by zbus:
# - remove detailed introspection of _child_ nodes
# - make interfaces order deterministic by sorting them
cleanup() {
    # also remove the DTD declaration
    # otherwise xmlstarlet will complain about it not being available
    sed -e '/^<!DOCTYPE/d' -e '/http.*introspect.dtd/d' \
        | xmlstarlet tr cleanup-zbus.xslt \
        | xmllint  --nonet --format -
}

# "dot dot name"
# "slash slash name"
DD=org.opensuse.Agama
SS=/${DD//./\/}

abusctl introspect --xml-interface ${DD}1 ${SS}1/Manager \
        | cleanup \
        > ${DD}1.Manager.bus.xml

look() {
    abusctl tree --list $DD.${1%.*}
    abusctl introspect --xml-interface $DD.${1%.*} $SS/${1//./\/} \
            | cleanup \
            > $DD.$1.bus.xml
}

look Locale1
look Questions1
look Software1
look Software1.Proposal
look Storage1
look Users1

abusctl introspect --xml-interface \
  ${DD}.Questions1 \
  ${SS}/Questions1 \
  | cleanup \
  > ${DD}.Questions1.bus.xml

abusctl call \
  ${DD}.Questions1 \
  ${SS}/Questions1 \
  ${DD}.Questions1 \
  New sasas "should I stay or should I go" 2 yes no 1 yes
abusctl introspect --xml-interface \
  ${DD}.Questions1 \
  ${SS}/Questions1/0 \
  | cleanup \
  > ${DD}.Questions1.Generic.bus.xml

abusctl call \
   ${DD}.Questions1 \
   ${SS}/Questions1 \
   ${DD}.Questions1 \
   NewLuksActivation sssy "/dev/tape1" "ZX Spectrum games" "90 minutes" 1
abusctl introspect --xml-interface \
  ${DD}.Questions1 \
  ${SS}/Questions1/1 \
  | cleanup \
  > ${DD}.Questions1.LuksActivation.bus.xml
