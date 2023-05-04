#!/bin/bash
abusctl() {
    busctl --address=unix:path=/run/agama/bus "$@"
}

DD=org.opensuse.Agama
SS=/${DD//./\/}

abusctl introspect --xml-interface ${DD}1 ${SS}1/Manager \
        > ${DD}1.Manager.bus.xml

look() {
    abusctl tree --list $DD.${1%.*}
    abusctl introspect --xml-interface $DD.${1%.*} $SS/${1//./\/} \
            > $DD.$1.bus.xml
}

look Language1
look Questions1
look Software1
look Software1.Proposal
look Storage1
look Users1
