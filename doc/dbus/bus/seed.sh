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

look() {
    abusctl tree --list $DD.${1%.*}
    abusctl introspect --xml-interface $DD.${1%.*} $SS/${1//./\/} \
            | cleanup \
            > $DD.$1.bus.xml
}

look Manager1
look Software1
look Software1.Proposal
look Storage1

abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Questions \
  | cleanup \
  > ${DD}1.Questions.bus.xml

abusctl call \
  ${DD}1 \
  ${SS}1/Questions \
  ${DD}1.Questions \
  New "ssassa{ss}" "org.bands.Clash" "should I stay or should I go" 2 yes no yes 0
abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Questions/0 |
  cleanup \
    >${DD}1.Questions.Generic.bus.xml

abusctl call \
  ${DD}1 \
  ${SS}1/Questions \
  ${DD}1.Questions \
  NewWithPassword "ssassa{ss}" "world.MiddleEarth.Moria.gate1" "Speak friend and enter" 2 enter giveup giveup 0
abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Questions/1 |
  cleanup \
    >${DD}1.Questions.WithPassword.bus.xml

abusctl introspect --xml-interface \
  ${DD}.Manager1 \
  ${SS}/Users1 \
  | cleanup \
  >${DD}.Users1.bus.xml
