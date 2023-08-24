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
  New "ssassa{ss}" "org.bands.Clash" "should I stay or should I go" 2 yes no yes 0
abusctl introspect --xml-interface \
  ${DD}.Questions1 \
  ${SS}/Questions1/0 \
  | cleanup \
  > ${DD}.Questions1.Generic.bus.xml

abusctl call \
   ${DD}.Questions1 \
   ${SS}/Questions1 \
   ${DD}.Questions1 \
   NewWithPassword "ssassa{ss}" "world.MiddleEarth.Moria.gate1" "Speak friend and enter" 2 enter giveup giveup 0
abusctl introspect --xml-interface \
  ${DD}.Questions1 \
  ${SS}/Questions1/1 \
  | cleanup \
  > ${DD}.Questions1.WithPassword.bus.xml
