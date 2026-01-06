#! /bin/bash

BACK_TITLE="System installation - network configuration"
# plain http is enough, we only check that the server is reachable via HEAD request
TEST_URL="http://www.suse.com"

# where to save the proxy configuration
proxy_file="/etc/cmdline.d/99-proxy-setup.conf"

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
  # repeat getting the config if it is empty (NM not ready yet)
  for i in {1..5}; do
    # delete the included help text at the end
    summary=$(nmcli | sed '/^Use "nmcli device show"/,$d')
    # break the loop if we have a non-empty summary without "connecting" status
    if [ -n "$summary" ] && [[ "$summary" != *"connecting"* ]]; then
      break
    else
      echo "Reading network configuration..."
      sleep 2
    fi
  done

  if [ -n "$http_proxy" ]; then
    # hide the password in the proxy URL
    proxy_label=$(echo "$http_proxy" | sed 's|://.*@|://*******@|')
  else
    proxy_label="<Not configured>"
  fi
  summary="$summary\n\nProxy configuration:\n      server: $proxy_label"

  # terminal size might change during runtime, evaluate it in each iteration
  term_width=$(tput cols 2>/dev/null || echo 80)
  term_height=$(tput lines 2>/dev/null || echo 24)
  # set to 80% of terminal size
  width=$((term_width * 80 / 100))
  height=$((term_height * 80 / 100))

  dialog --clear --no-collapse --backtitle "$BACK_TITLE" --title "Current network configuration" \
    --ok-label "Continue" \
    --extra-button --extra-label "Edit" \
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
    fi
  # continue button or Esc (255) pressed, leave the script
  elif [ $button -eq 0 ] || [ $button -eq 255 ]; then
    # clear possible dialog leftovers on the screen
    clear
    exit 0
  # edit button pressed, run the network configuration
  else
    nmtui

    proxy_address=$(dialog --clear --no-cancel --backtitle "$BACK_TITLE" --title "HTTP proxy address" \
		  --stdout --inputbox "Enter the HTTP proxy URL (e.g. http://proxy.example.com:3128)\nor leave empty to not use any proxy." \
			10 70 "$http_proxy")

    exit_status=$?
    if [ $exit_status -eq 0 ]; then
      if [ -z "$proxy_address" ]; then
        unset http_proxy
        unset https_proxy
        rm -f "$proxy_file"
      else
        echo "proxy=$proxy_address" >"$proxy_file"
        export http_proxy="$proxy_address"
        export https_proxy="$proxy_address"
      fi
    fi
  fi
done
