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

abusctl introspect --xml-interface ${DD}1 ${SS}1/Locale \
        | cleanup \
        > ${DD}1.Locale.bus.xml

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
look Users1

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
  ${SS}1/Questions/0 \
  | cleanup \
  > ${DD}1.Questions.Generic.bus.xml

abusctl call \
   ${DD}1 \
   ${SS}1/Questions \
   ${DD}1.Questions \
   NewWithPassword "ssassa{ss}" "world.MiddleEarth.Moria.gate1" "Speak friend and enter" 2 enter giveup giveup 0
abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Questions/1 \
  | cleanup \
  > ${DD}1.Questions.WithPassword.bus.xml

# Network interfaces
abusctl call \
  ${DD}1 \
  ${SS}1/Network/connections \
  ${DD}1.Network.Connections \
  AddConnection "sy" "wireless0" 2

OBJ=$(abusctl call \
  ${DD}1 \
  ${SS}1/Network/connections \
  ${DD}1.Network.Connections \
  GetConnection "s" "wireless0" | cut -f2 -d\")

abusctl introspect --xml-interface \
  ${DD}1 \
  ${OBJ} \
  ${DD}1.Network.Connection \
  | cleanup \
  >${DD}1.Network.Connection.bus.xml

abusctl call \
  ${DD}1 \
  ${SS}1/Network/connections \
  ${DD}1.Network.Connections \
  RemoveConnection "s" "wireless0"

abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Network/connections \
  ${DD}1.Network.Connections \
  | cleanup \
  >${DD}1.Network.Connections.bus.xml

abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Network/devices \
  ${DD}1.Network.Devices \
  | cleanup \
  >${DD}1.Network.Devices.bus.xml

abusctl introspect --xml-interface \
  ${DD}1 \
  ${SS}1/Network/devices/0 \
  ${DD}1.Network.Device \
  | cleanup \
  >${DD}1.Network.Device.bus.xml
