#!/bin/sh

xdump4() {
    hexdump -n 4 -ve '/1 "%02x"' "$1"
}

get_dev_hcn() {
    local dev=$1
    local HCNID
    local DEVNAME
    
    HCNID=$(xdump4 "$dev"/ibm,hcn-id)
    if [ -z "$HCNID" ]; then
        return 1
    fi
    
    # Get the device name using ofpathname
    DEVNAME=$(ofpathname -l "$(echo "$dev" | sed -e "s/\/proc\/device-tree//")" 2>/dev/null)
    if [ -n "$DEVNAME" ]; then
        echo "bond$HCNID $DEVNAME"
        return 0
    fi
    return 1
}

# Collect all mappings
MAPPINGS=""
if [ -d /proc/device-tree ]; then
    for pci_dev in /proc/device-tree/pci*; do
        [ -d "$pci_dev" ] || continue
        for dev in "$pci_dev"/ethernet*; do
            [ -d "$dev" ] || continue
            if [ -e "$dev"/ibm,hcn-id ]; then
                res=$(get_dev_hcn "$dev")
                if [ -n "$res" ]; then
                    MAPPINGS="$MAPPINGS $res"
                fi
            fi
        done
    done
fi

if [ -z "$MAPPINGS" ]; then
    return 0
fi

# We might not have CMDLINE variable exported if it's an older dracut, so let's check
if [ -z "$CMDLINE" ]; then
    CMDLINE=$(cat /proc/cmdline)
fi

NEW_CMDLINE="$CMDLINE"
REPLACED=0

set -- $MAPPINGS
while [ $# -ge 2 ]; do
    BONDNAME="$1"
    DEVNAME="$2"
    shift 2
    
    # Check if DEVNAME is in the cmdline
    if echo "$NEW_CMDLINE" | grep -q "$DEVNAME"; then
        # Replace DEVNAME with BONDNAME for ip=... arguments
        NEW_CMDLINE=$(echo "$NEW_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$DEVNAME\([: ]\|$\)/\1$BONDNAME\2/g")
        
        # Check if replacement occurred to add bond options
        if [ "$NEW_CMDLINE" != "$CMDLINE" ] || [ $REPLACED -eq 1 ]; then
            # We don't want to add multiple bond= arguments for the same bond, 
            # but Dracut can handle it, or we just append it once.
            if ! echo "$NEW_CMDLINE" | grep -q "bond=$BONDNAME:"; then
                NEW_CMDLINE="$NEW_CMDLINE bond=$BONDNAME:$DEVNAME:mode=1,miimon=100,fail_over_mac=2"
            fi
            REPLACED=1
        fi
    fi
done

if [ $REPLACED -eq 1 ]; then
    export CMDLINE="$NEW_CMDLINE"
    echo "$NEW_CMDLINE" > /etc/cmdline.d/99-hcnmgr.conf
fi
