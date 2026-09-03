#! /bin/bash

# Ensure required tools are installed
for cmd in dialog jq; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "The '$cmd' command is not installed. Please install it."
    exit 1
  fi
done

# finish function to clear the screen on exit or cancellation
finish() {
  clear
  exit 0
}
trap finish SIGHUP SIGINT SIGTERM

# Helper function to ask for a password and confirm it
ask_password() {
  local prompt="$1"
  local var_name="$2"
  local pw1 pw2

  while true; do
    pw1=$(dialog "${DIALOG_COMMON[@]}" --insecure --title "Password Setup" \
      --passwordbox "Enter $prompt:" 10 40 3>&1 1>&2 2>&3)
    # Exit if user hits Cancel
    if [ $? -ne 0 ]; then return 1; fi

    pw2=$(dialog "${DIALOG_COMMON[@]}" --insecure --title "Password Setup" \
      --passwordbox "Confirm $prompt:" 10 40 3>&1 1>&2 2>&3)
    if [ $? -ne 0 ]; then return 1; fi

    if [ "$pw1" = "$pw2" ]; then
      eval "$var_name=\"\$pw1\""
      return 0
    else
      dialog "${DIALOG_COMMON[@]}" --title "Error" \
        --msgbox "Passwords do not match. Please try again." 8 40
    fi
  done
}

# read using relative path to this script so it works also when running from Git sources
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
CONFIG="${SCRIPT_DIR}/../share/cc-setup/defaults.json"

# Read the selected product from the default configuration
if [ -f "$CONFIG" ]; then
  PRODUCT_ID=$(jq -r '.product.id // empty' "$CONFIG")
else
  echo "ERROR: Default configuration file not found: $CONFIG"
  exit 1
fi

PRODUCT_NAME="$PRODUCT_ID"
if [ -n "$PRODUCT_ID" ]; then
  # Find the corresponding product YAML file to extract the product name
  for file in /usr/share/agama/products.d/*.yml /usr/share/agama/products.d/*.yaml "${SCRIPT_DIR}"/../../../../products.d/*.yaml; do
    [ -e "$file" ] || continue
    # Check if the id matches
    if grep -q -E "^[[:space:]]*id:[[:space:]]*['\"]?${PRODUCT_ID}['\"]?[[:space:]]*$" "$file"; then
      # Extract the name and remove optional surrounding quotes
      parsed_name=$(grep -E "^[[:space:]]*name:" "$file" | head -n 1 | sed -E 's/^[[:space:]]*name:[[:space:]]*//' | sed -E "s/^['\"](.*)['\"]$/\1/")
      if [ -n "$parsed_name" ]; then
        PRODUCT_NAME="$parsed_name"
      fi
      break
    fi
  done
fi

readonly DIALOG_COMMON=(--clear --backtitle "Install $PRODUCT_NAME")

while true; do
  # 1. Main Menu
  CHOICE=$(dialog "${DIALOG_COMMON[@]}" --no-cancel \
    --menu "Choose installation method:" 12 55 3 \
    "1" "Install using predefined defaults" \
    "2" "Set values interactively" \
    "3" "Reboot" 3>&1 1>&2 2>&3)

  # Handle ESC key in the main menu
  if [ $? -ne 0 ]; then
    continue
  fi

  # 2. Process selection
  case $CHOICE in
  1)
    # Use the defaults, nothing to change
    ;;
  2)
    # Interactive mode: Root password
    if ! ask_password "root password" ROOT_PW; then continue; fi

    # Interactive mode: User login name
    USERNAME=$(dialog "${DIALOG_COMMON[@]}" --title "User Setup" \
      --inputbox "Enter user login name:" 10 40 3>&1 1>&2 2>&3)
    if [ $? -ne 0 ] || [ -z "$USERNAME" ]; then continue; fi

    # Interactive mode: User full name
    FULLNAME=$(dialog "${DIALOG_COMMON[@]}" --title "User Setup" \
      --inputbox "Enter user full name:" 10 40 3>&1 1>&2 2>&3)
    if [ $? -ne 0 ] || [ -z "$FULLNAME" ]; then continue; fi

    # Interactive mode: User password
    if ! ask_password "password for user '$USERNAME'" USER_PW; then continue; fi

    # Interactive mode: Registration
    REG_ADD=false
    if tmp_email=$(dialog "${DIALOG_COMMON[@]}" --title "Product Registration" \
      --inputbox "Enter registration email (Cancel to skip):" 10 50 3>&1 1>&2 2>&3); then
      if tmp_code=$(dialog "${DIALOG_COMMON[@]}" --title "Product Registration" \
        --inputbox "Enter registration code (Cancel to skip):" 10 50 3>&1 1>&2 2>&3); then
        REG_EMAIL="$tmp_email"
        REG_CODE="$tmp_code"
        REG_ADD=true
      fi
    fi
    ;;
  3)
    reboot
    finish
    ;;
  esac

  # Prepare summary message
  if [ "$CHOICE" = "1" ]; then
    SUMMARY="Using default configuration"
  else
    ROOT_PW_DISP=$([ -n "$ROOT_PW" ] && echo "(set)" || echo "(empty)")
    USER_PW_DISP=$([ -n "$USER_PW" ] && echo "(set)" || echo "(empty)")
    REG_CODE_DISP=$([ -n "$REG_CODE" ] && echo "(set)" || echo "(empty)")
    REG_EMAIL_DISP=${REG_EMAIL:-(empty)}

    SUMMARY="Root password: $ROOT_PW_DISP\nUser login: ${USERNAME:-(empty)}\nUser full name: ${FULLNAME:-(empty)}\nUser password: $USER_PW_DISP\nRegistration email: $REG_EMAIL_DISP\nRegistration code: $REG_CODE_DISP"
  fi

  # 3. Confirmation Dialog
  dialog "${DIALOG_COMMON[@]}" --title "WARNING: Destructive Action!" --defaultno \
    --yesno "Configuration summary:\n----------------------\n$SUMMARY\n\nALL DATA ON DISK WILL BE LOST!\n\nAre you sure you want to continue?" 18 60

  # Check user response (0 = Yes, 1 = No)
  if [ $? -eq 0 ]; then
    clear

    # build the JSON and load it to Agama
    if [ "$CHOICE" = "2" ]; then
      if [ "$REG_ADD" = true ]; then
        jq --arg rp "$ROOT_PW" \
          --arg un "$USERNAME" \
          --arg fn "$FULLNAME" \
          --arg up "$USER_PW" \
          --arg re "$REG_EMAIL" \
          --arg rc "$REG_CODE" \
          '.root.password = $rp | .root.hashedPassword = false | .user.userName = $un | .user.fullName = $fn | .user.password = $up | .user.hashedPassword = false | .product.registrationEmail = $re | .product.registrationCode = $rc' \
          "$CONFIG" | agama config load
      else
        jq --arg rp "$ROOT_PW" \
          --arg un "$USERNAME" \
          --arg fn "$FULLNAME" \
          --arg up "$USER_PW" \
          '.root.password = $rp | .root.hashedPassword = false | .user.userName = $un | .user.fullName = $fn | .user.password = $up | .user.hashedPassword = false' \
          "$CONFIG" | agama config load
      fi
    else
      agama config load < "$CONFIG"
    fi

    # start the installation
    agama install

    # run the monitor in background, unfortunately it does not automatically exit when the installation is finished
    agama monitor &
    MONITOR_PID=$!

    # regularly query the installer status, wait until the installation is finished
    while true; do
      STATUS=$(curl -s -H "Authorization: Bearer $(cat /run/agama/token)" http://localhost/api/manager/installer)
      PHASE=$(echo "$STATUS" | jq -r '.phase' 2> /dev/null)
      IS_BUSY=$(echo "$STATUS" | jq -r '.isBusy' 2> /dev/null)

      # the installation is finished
      if [ "$PHASE" = "3" ] && [ "$IS_BUSY" = "false" ]; then
        echo "Installation finished"
        kill $MONITOR_PID 2> /dev/null || true
        agama finish
        break
      fi

      sleep 10
    done

    break
  fi
done

finish
