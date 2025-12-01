#! /bin/bash

TERMINAL_WIDTH=$(tput cols 2>/dev/null || echo 80)
TERMINAL_HEIGHT=$(tput lines 2>/dev/null || echo 24)
BACK_TITLE="System installation - network configuration"
# plain http is enough, we only check that the server is reachable via HEAD request
TEST_URL="http://www.suse.com"

# set to 80% of terminal size
width=$((TERMINAL_WIDTH * 80 / 100))
height=$((TERMINAL_HEIGHT * 80 / 100))

# read the current proxy value
# get the configured network proxy (empty string if not configured)
# see ../lib/dracut/modules.d/98dracut-menu/dracut-cmdline-menu.sh
# get the last found, it has the highest priority
PROXY=$(grep "\bproxy=" /proc/cmdline /etc/cmdline.d/* | tail -n 1 | sed "s/.*\bproxy=\([^ \t]*\).*/\1/")
if [ -n "$PROXY" ]; then
  export http_proxy="$PROXY"
  export https_proxy="$PROXY"
fi

while :; do
  nmtui

  # ask for configuring http proxy
  dialog --clear --backtitle "$BACK_TITLE" --title "HTTP proxy configuration" --defaultno --yesno "Do you want to configure an HTTP proxy for network access?" 7 65
  response=$?

  if [ $response -eq 0 ]; then
    proxy_address=$(dialog --clear --backtitle "$BACK_TITLE" --title "HTTP proxy address" --stdout --inputbox "Enter the HTTP proxy URL (e.g., http://proxy.example.com:3128)" 8 70 "$http_proxy")
    exit_status=$?
    if [ $exit_status -eq 0 ]; then
      echo "proxy=$proxy_address" >/etc/cmdline.d/99-proxy-setup.conf
      export http_proxy="$proxy_address"
      export https_proxy="$proxy_address"
    fi
  fi

  while :; do
    # delete the included help text at the end
    summary=$(nmcli | sed '/^Use "nmcli device show"/,$d')

    if [ -n "$http_proxy" ]; then
      # hide the password in the proxy URL
      proxy_label=$(echo "$http_proxy" | sed 's|://.*@|://*******@|')
      summary="$summary\n\nProxy configuration:\n      server: $proxy_label"
    fi

    dialog --clear --no-collapse --backtitle "$BACK_TITLE" --title "Current network configuration" \
      --ok-label "Continue" \
      --extra-button --extra-label "Back" \
      --help-button --help-label "Test connection" \
      --cr-wrap --msgbox "\n$summary" "$height" "$width"

    # the exit value refers to the pressed button
    button=$?

    # test button pressed
    if [ $button -eq 2 ]; then
      dialog --backtitle "$BACK_TITLE" --title "Network connection test" --infobox "\nTesting network connectivity...\nPlease wait." 7 50

      # simple connectivity test
      out=$(curl --head --silent --show-error --connect-timeout 20 --max-time 10 --retry 2 --retry-connrefused -o /dev/null "$TEST_URL" 2>&1)
      if [ $? -eq 0 ]; then
        label="The network connectivity test succeeded."
        dialog --clear --backtitle "$BACK_TITLE" --title "Network Test Result" --msgbox "\n$label" 7 50
      else
        label="Network connectivity test failed!\nCheck the network configuration."
        # remove duplicate errors from retries
        details=$(echo "$out" | uniq)
        label="$label\n\nDetails:\n$details"

        dialog --clear --backtitle "$BACK_TITLE" --title "Network Test Result" --msgbox "\n$label" 12 70
        # go back to the network configuration
        break
      fi
    # continue button or Esc (255) pressed, leave the script
    elif [ $button -eq 0 ] || [ $button -eq 255 ]; then
      # clear possible dialog leftovers on the screen
      clear
      exit 0
    # back button pressed, start again
    else
      break
    fi
  done
done
