#!/bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/net-lib.sh

ifcfg_to_ip() {
  local ip
  local v="${2}",
  local interface="$1"
  local mac="$3"
  local conf_path="/etc/cmdline.d/40-agama-network.conf"
  set --
  while [ -n "$v" ]; do
    set -- "$@" "${v%%,*}"
    v=${v#*,}
  done

  if [[ $# -eq 0 ]]; then
    echo "IFCFG 0 options given, must be wrong"
    return 1
  fi

  ### See https://en.opensuse.org/SDB:Linuxrc#Network_Config
  # ifcfg=<interface_spec>=[try,]dhcp*,[rfc2132,]OPTION1=value1,OPTION2=value2...
  if str_starts "$1" "dhcp"; then
    autoconf="$1"
    if [ "$autoconf" = "dhcp4" ]; then
      echo "AUTOCONF"
      autoconf="dhcp"
    fi
    case $autoconf in
    "dhcp" | "dhcp6")
      if [ "$interface" = "*" ]; then
        echo "ip=${1}" >>"/etc/cmdline.d/40-agama-network.conf"
      else
        echo "ip=${interface}:${1}" >>$conf_path
      fi
      ;;
    *)
      echo "No supported option ${1}"
      ;;
    esac

    return 0
  fi

  # ifcifg=<interface_spec>=ip,gateway,nameserver,domain
  if strglob "$1" "*.*.*.*/*"; then
    [[ -n "$2" ]] && gateway=$2
    [[ -n "$3" ]] && nameserver=$3
    [[ -n "$4" ]] && domain=$4

    ip="$1 "
    set --
    while [ -n "$ip" ]; do
      set -- "$@" "${ip%% *}"
      ip="${ip#* }"
    done

    ## TODO: IP is a LIST_IP
    ip="$1"
    mask=${ip##*/}
    ip=${ip%%/*}
    shift

    ## Configure the first interface, the gateway must belong to the same network
    echo "ip=${ip}::${gateway}:$mask::${interface}" >>$conf_path

    ## Configure multiple addresses for the same interface
    while [[ $# -gt 0 ]]; do
      ip="$1"
      mask=${ip##*/}
      ip=${ip%%/*}
      echo "ip=${ip}:::$mask::${interface}" >>$conf_path
      shift
    done

    ## Configure nameservers
    if [[ -n $nameserver ]]; then
      nameserver="$nameserver "
      while [ -n "$nameserver" ]; do
        echo "nameserver=${nameserver%% *}" >>$conf_path
        nameserver="${nameserver#* }"
      done
    fi
  fi

  return 0
}

translate_ifcfg() {
  local i
  local first
  local match
  local vlan
  local phydevice
  local conf_path="/etc/cmdline.d/40-agama-network.conf"

  while read i; do
    set --
    echo "### Processing $i ###"
    set -- "$@" "${i%%=*}"
    options="${i#*=}"
    pattern="$1"
    first=0
    match=0
    unset vlan phydevice

    if str_starts "$options" "try,"; then
      options="${i#*try,*}"
      first=1
    fi

    # The pattern Looks like a VLAN like eth0.10
    if strglobin "$pattern" "*.[0-9]*"; then
      phydevice=${pattern%.*}
      vlan="vlan=$1:$phydevice"
      echo "$vlan" >>$conf_path
      ifcfg_to_ip "$pattern" "$options"
      continue
    fi

    # We cannot iterate over devices by now, therefore only '*' or an specific
    # interface name is supported
    #if [ "$pattern" = "*" ]; then
    ifcfg_to_ip "$pattern" "$options"
    continue
    #fi

    # nm-initrd-generator is executed too early and there are no
    # devices at all, therefore this code does not make sense by now
    for path in /sys/class/net/*; do
      iface=${path##*/}
      mac=$(cat "$path/address")
      echo "   $path"
      case $iface in
      lo)
        echo "Skipping lo interface"
        continue
        ;;
      $pattern)
        ifcfg_to_ip "$iface" "$options"
        if [[ $first == 1 ]]; then
          echo "try given, breaking"
          match=1
        fi
        #if [ -n "$ip" ]; then
        #  echo "ip=${ip}" >>"/etc/cmdline.d/agama_network.conf"
        #fi
        ;;
      esac
      case $mac in
      $pattern)
        ifcfg_to_ip "$iface" "$options" "$mac"
        if [[ $first == 1 ]]; then
          echo "try given, breaking"
          match=1
        fi
        ;;
      esac

      if [[ "$match" -eq 1 ]] && [[ $first == 1 ]]; then
        break
      fi
    done
    echo

    set --
    unset options pattern
  done <<<"$(getargs ifcfg=)"

  unset CMDLINE
  return 0
}

translate_ifcfg
