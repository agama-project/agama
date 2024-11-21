import agama from "../agama";

agama.locale({
 "": {
  "plural-forms": (n) => n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2,
  "language": "uk"
 },
 "Change product": [
  null,
  ""
 ],
 "Confirm Installation": [
  null,
  ""
 ],
 "If you continue, partitions on your hard disk will be modified according to the provided installation settings.": [
  null,
  ""
 ],
 "Please, cancel and check the settings if you are unsure.": [
  null,
  ""
 ],
 "Continue": [
  null,
  ""
 ],
 "Cancel": [
  null,
  ""
 ],
 "Install": [
  null,
  ""
 ],
 "TPM sealing requires the new system to be booted directly.": [
  null,
  ""
 ],
 "If a local media was used to run this installer, remove it before the next boot.": [
  null,
  ""
 ],
 "Hide details": [
  null,
  ""
 ],
 "See more details": [
  null,
  ""
 ],
 "The final step to configure the Trusted Platform Module (TPM) to automatically open encrypted devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader.": [
  null,
  ""
 ],
 "Congratulations!": [
  null,
  ""
 ],
 "The installation on your machine is complete.": [
  null,
  ""
 ],
 "At this point you can power off the machine.": [
  null,
  ""
 ],
 "At this point you can reboot the machine to log in to the new system.": [
  null,
  ""
 ],
 "Finish": [
  null,
  ""
 ],
 "Reboot": [
  null,
  ""
 ],
 "Installing the system, please wait...": [
  null,
  ""
 ],
 "Installer options": [
  null,
  ""
 ],
 "Language": [
  null,
  ""
 ],
 "Keyboard layout": [
  null,
  ""
 ],
 "Cannot be changed in remote installation": [
  null,
  ""
 ],
 "Accept": [
  null,
  ""
 ],
 "Before starting the installation, you need to address the following problems:": [
  null,
  ""
 ],
 "Installation not possible yet because of issues. Check them at Overview page.": [
  null,
  ""
 ],
 "Installation issues": [
  null,
  ""
 ],
 "Search": [
  null,
  ""
 ],
 "Could not log in. Please, make sure that the password is correct.": [
  null,
  ""
 ],
 "Could not authenticate against the server, please check it.": [
  null,
  ""
 ],
 "Log in as %s": [
  null,
  ""
 ],
 "The installer requires [root] user privileges.": [
  null,
  ""
 ],
 "Please, provide its password to log in to the system.": [
  null,
  ""
 ],
 "Login form": [
  null,
  ""
 ],
 "Password input": [
  null,
  ""
 ],
 "Log in": [
  null,
  ""
 ],
 "Back": [
  null,
  ""
 ],
 "Passwords do not match": [
  null,
  ""
 ],
 "Password": [
  null,
  ""
 ],
 "Password confirmation": [
  null,
  ""
 ],
 "Password visibility button": [
  null,
  ""
 ],
 "Confirm": [
  null,
  ""
 ],
 "Pending": [
  null,
  ""
 ],
 "In progress": [
  null,
  ""
 ],
 "Finished": [
  null,
  ""
 ],
 "Actions": [
  null,
  ""
 ],
 "Waiting": [
  null,
  ""
 ],
 "Cannot connect to Agama server": [
  null,
  ""
 ],
 "Please, check whether it is running.": [
  null,
  ""
 ],
 "Reload": [
  null,
  ""
 ],
 "Filter by description or keymap code": [
  null,
  ""
 ],
 "None of the keymaps match the filter.": [
  null,
  ""
 ],
 "Keyboard selection": [
  null,
  ""
 ],
 "Select": [
  null,
  ""
 ],
 "Localization": [
  null,
  ""
 ],
 "Not selected yet": [
  null,
  ""
 ],
 "Change": [
  null,
  ""
 ],
 "Keyboard": [
  null,
  ""
 ],
 "Time zone": [
  null,
  ""
 ],
 "Filter by language, territory or locale code": [
  null,
  ""
 ],
 "None of the locales match the filter.": [
  null,
  ""
 ],
 "Locale selection": [
  null,
  ""
 ],
 "Filter by territory, time zone code or UTC offset": [
  null,
  ""
 ],
 "None of the time zones match the filter.": [
  null,
  ""
 ],
 " Timezone selection": [
  null,
  ""
 ],
 "Options toggle": [
  null,
  ""
 ],
 "Download logs": [
  null,
  ""
 ],
 "Installer Options": [
  null,
  ""
 ],
 "Main navigation": [
  null,
  ""
 ],
 "Loading installation environment, please wait.": [
  null,
  ""
 ],
 "Remove": [
  null,
  ""
 ],
 "IP Address": [
  null,
  ""
 ],
 "Prefix length or netmask": [
  null,
  ""
 ],
 "Add an address": [
  null,
  ""
 ],
 "Add another address": [
  null,
  ""
 ],
 "Addresses": [
  null,
  ""
 ],
 "Addresses data list": [
  null,
  ""
 ],
 "Name": [
  null,
  ""
 ],
 "IP addresses": [
  null,
  ""
 ],
 "Connection actions": [
  null,
  ""
 ],
 "Edit": [
  null,
  ""
 ],
 "Edit connection %s": [
  null,
  ""
 ],
 "Forget": [
  null,
  ""
 ],
 "Forget connection %s": [
  null,
  ""
 ],
 "Actions for connection %s": [
  null,
  ""
 ],
 "Server IP": [
  null,
  ""
 ],
 "Add DNS": [
  null,
  ""
 ],
 "Add another DNS": [
  null,
  ""
 ],
 "DNS": [
  null,
  ""
 ],
 "Ip prefix or netmask": [
  null,
  ""
 ],
 "At least one address must be provided for selected mode": [
  null,
  ""
 ],
 "Mode": [
  null,
  ""
 ],
 "Automatic (DHCP)": [
  null,
  ""
 ],
 "Manual": [
  null,
  ""
 ],
 "Gateway": [
  null,
  ""
 ],
 "Gateway can be defined only in 'Manual' mode": [
  null,
  ""
 ],
 "Wired": [
  null,
  ""
 ],
 "No wired connections found": [
  null,
  ""
 ],
 "Wi-Fi": [
  null,
  ""
 ],
 "Connect": [
  null,
  ""
 ],
 "Connected to %s": [
  null,
  ""
 ],
 "No connected yet": [
  null,
  ""
 ],
 "The system has not been configured for connecting to a Wi-Fi network yet.": [
  null,
  ""
 ],
 "No Wi-Fi supported": [
  null,
  ""
 ],
 "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.": [
  null,
  ""
 ],
 "Network": [
  null,
  ""
 ],
 "None": [
  null,
  ""
 ],
 "WPA & WPA2 Personal": [
  null,
  ""
 ],
 "WiFi connection form": [
  null,
  ""
 ],
 "Authentication failed, please try again": [
  null,
  ""
 ],
 "Something went wrong": [
  null,
  ""
 ],
 "Please, review provided settings and try again.": [
  null,
  ""
 ],
 "SSID": [
  null,
  ""
 ],
 "Security": [
  null,
  ""
 ],
 "WPA Password": [
  null,
  ""
 ],
 "Connecting": [
  null,
  ""
 ],
 "Connected": [
  null,
  ""
 ],
 "Disconnected": [
  null,
  ""
 ],
 "Disconnect": [
  null,
  ""
 ],
 "Connect to hidden network": [
  null,
  ""
 ],
 "configured": [
  null,
  ""
 ],
 "No visible Wi-Fi networks found": [
  null,
  ""
 ],
 "Visible Wi-Fi networks": [
  null,
  ""
 ],
 "Connect to a Wi-Fi network": [
  null,
  ""
 ],
 "The system will use %s as its default language.": [
  null,
  ""
 ],
 "Users": [
  null,
  ""
 ],
 "Storage": [
  null,
  ""
 ],
 "Software": [
  null,
  ""
 ],
 "Installation blocking issues": [
  null,
  ""
 ],
 "Before installing, please check the following problems.": [
  null,
  ""
 ],
 "Overview": [
  null,
  ""
 ],
 "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.": [
  null,
  ""
 ],
 "Take your time to check your configuration before starting the installation process.": [
  null,
  ""
 ],
 "The installation will take": [
  null,
  ""
 ],
 "The installation will take %s including:": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group shrinking existing partitions at the underlying devices as needed": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group without modifying the partitions at the underlying devices": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group deleting all the content of the underlying devices": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group using a custom strategy to find the needed space at the underlying devices": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s shrinking existing partitions as needed": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s without modifying existing partitions": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s deleting all its content": [
  null,
  ""
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s using a custom strategy to find the needed space": [
  null,
  ""
 ],
 "No device selected yet": [
  null,
  ""
 ],
 "Install using device %s shrinking existing partitions as needed": [
  null,
  ""
 ],
 "Install using device %s without modifying existing partitions": [
  null,
  ""
 ],
 "Install using device %s and deleting all its content": [
  null,
  ""
 ],
 "Install using device %s with a custom strategy to find the needed space": [
  null,
  ""
 ],
 "%s logo": [
  null,
  ""
 ],
 "Select a product": [
  null,
  ""
 ],
 "Available products": [
  null,
  ""
 ],
 "Configuring the product, please wait ...": [
  null,
  ""
 ],
 "Question": [
  null,
  ""
 ],
 "The encryption password did not work": [
  null,
  ""
 ],
 "Encrypted Device": [
  null,
  ""
 ],
 "Encryption Password": [
  null,
  ""
 ],
 "Password Required": [
  null,
  ""
 ],
 "No additional software was selected.": [
  null,
  ""
 ],
 "The following software patterns are selected for installation:": [
  null,
  ""
 ],
 "Selected patterns": [
  null,
  ""
 ],
 "Change selection": [
  null,
  ""
 ],
 "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.": [
  null,
  ""
 ],
 "None of the patterns match the filter.": [
  null,
  ""
 ],
 "auto selected": [
  null,
  ""
 ],
 "Unselect": [
  null,
  ""
 ],
 "Software selection": [
  null,
  ""
 ],
 "Filter by pattern title or description": [
  null,
  ""
 ],
 "Close": [
  null,
  "Закрити"
 ],
 "Installation will take %s.": [
  null,
  ""
 ],
 "This space includes the base system and the selected software patterns, if any.": [
  null,
  ""
 ],
 "Change boot options": [
  null,
  ""
 ],
 "Installation will not configure partitions for booting.": [
  null,
  ""
 ],
 "Installation will configure partitions for booting at the installation disk.": [
  null,
  ""
 ],
 "Installation will configure partitions for booting at %s.": [
  null,
  ""
 ],
 "To ensure the new system is able to boot, the installer may need to create or configure some partitions in the appropriate disk.": [
  null,
  ""
 ],
 "Partitions to boot will be allocated at the installation disk.": [
  null,
  ""
 ],
 "Partitions to boot will be allocated at the installation disk (%s).": [
  null,
  ""
 ],
 "Select booting partition": [
  null,
  ""
 ],
 "Automatic": [
  null,
  ""
 ],
 "Select a disk": [
  null,
  ""
 ],
 "Partitions to boot will be allocated at the following device.": [
  null,
  ""
 ],
 "Choose a disk for placing the boot loader": [
  null,
  ""
 ],
 "Do not configure": [
  null,
  ""
 ],
 "No partitions will be automatically configured for booting. Use with caution.": [
  null,
  ""
 ],
 "The file systems will be allocated by default as [new partitions in the selected device].": [
  null,
  ""
 ],
 "The file systems will be allocated by default as [logical volumes of a new LVM Volume Group]. The corresponding physical volumes will be created on demand as new partitions at the selected devices.": [
  null,
  ""
 ],
 "Select installation device": [
  null,
  ""
 ],
 "Install new system on": [
  null,
  ""
 ],
 "An existing disk": [
  null,
  ""
 ],
 "A new LVM Volume Group": [
  null,
  ""
 ],
 "Device selector for target disk": [
  null,
  ""
 ],
 "Device selector for new LVM volume group": [
  null,
  ""
 ],
 "Prepare more devices by configuring advanced": [
  null,
  ""
 ],
 "storage techs": [
  null,
  ""
 ],
 "Multipath": [
  null,
  ""
 ],
 "DASD %s": [
  null,
  ""
 ],
 "Software %s": [
  null,
  ""
 ],
 "SD Card": [
  null,
  ""
 ],
 "%s disk": [
  null,
  ""
 ],
 "Disk": [
  null,
  ""
 ],
 "Members: %s": [
  null,
  ""
 ],
 "Devices: %s": [
  null,
  ""
 ],
 "Wires: %s": [
  null,
  ""
 ],
 "%s with %d partitions": [
  null,
  ""
 ],
 "No content found": [
  null,
  ""
 ],
 "Device": [
  null,
  ""
 ],
 "Details": [
  null,
  ""
 ],
 "Size": [
  null,
  ""
 ],
 "Manage and format": [
  null,
  ""
 ],
 "Activate disks": [
  null,
  ""
 ],
 "zFCP": [
  null,
  ""
 ],
 "Connect to iSCSI targets": [
  null,
  ""
 ],
 "iSCSI": [
  null,
  ""
 ],
 "disabled": [
  null,
  ""
 ],
 "enabled": [
  null,
  ""
 ],
 "using TPM unlocking": [
  null,
  ""
 ],
 "Enable": [
  null,
  ""
 ],
 "Modify": [
  null,
  ""
 ],
 "Encryption": [
  null,
  ""
 ],
 "Protection for the information stored at the device, including data, programs, and system files.": [
  null,
  ""
 ],
 "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot": [
  null,
  ""
 ],
 "The password will not be needed to boot and access the data if the TPM can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.": [
  null,
  ""
 ],
 "Full Disk Encryption (FDE) allows to protect the information stored at the device, including data, programs, and system files.": [
  null,
  ""
 ],
 "Encrypt the system": [
  null,
  ""
 ],
 "File systems created as new partitions at %s": [
  null,
  ""
 ],
 "File systems created at a new LVM volume group": [
  null,
  ""
 ],
 "File systems created at a new LVM volume group on %s": [
  null,
  ""
 ],
 "Main disk or LVM Volume Group for installation.": [
  null,
  ""
 ],
 "Installation device": [
  null,
  ""
 ],
 "Maximum must be greater than minimum": [
  null,
  ""
 ],
 "at least %s": [
  null,
  ""
 ],
 "Transactional Btrfs root volume (%s)": [
  null,
  ""
 ],
 "Transactional Btrfs root partition (%s)": [
  null,
  ""
 ],
 "Btrfs root volume with snapshots (%s)": [
  null,
  ""
 ],
 "Btrfs root partition with snapshots (%s)": [
  null,
  ""
 ],
 "Mount %1$s at %2$s (%3$s)": [
  null,
  ""
 ],
 "Swap at %1$s (%2$s)": [
  null,
  ""
 ],
 "Swap volume (%s)": [
  null,
  ""
 ],
 "Swap partition (%s)": [
  null,
  ""
 ],
 "%1$s root at %2$s (%3$s)": [
  null,
  ""
 ],
 "%1$s root volume (%2$s)": [
  null,
  ""
 ],
 "%1$s root partition (%2$s)": [
  null,
  ""
 ],
 "%1$s %2$s at %3$s (%4$s)": [
  null,
  ""
 ],
 "%1$s %2$s volume (%3$s)": [
  null,
  ""
 ],
 "%1$s %2$s partition (%3$s)": [
  null,
  ""
 ],
 "Do not configure partitions for booting": [
  null,
  ""
 ],
 "Boot partitions at installation disk": [
  null,
  ""
 ],
 "Boot partitions at %s": [
  null,
  ""
 ],
 "These limits are affected by:": [
  null,
  ""
 ],
 "The configuration of snapshots": [
  null,
  ""
 ],
 "Presence of other volumes (%s)": [
  null,
  ""
 ],
 "The amount of RAM in the system": [
  null,
  ""
 ],
 "auto": [
  null,
  ""
 ],
 "Reused %s": [
  null,
  ""
 ],
 "Transactional Btrfs": [
  null,
  ""
 ],
 "Btrfs with snapshots": [
  null,
  ""
 ],
 "Partition at %s": [
  null,
  ""
 ],
 "Separate LVM at %s": [
  null,
  ""
 ],
 "Logical volume at system LVM": [
  null,
  ""
 ],
 "Partition at installation disk": [
  null,
  ""
 ],
 "Reset location": [
  null,
  ""
 ],
 "Change location": [
  null,
  ""
 ],
 "Delete": [
  null,
  ""
 ],
 "Mount point": [
  null,
  ""
 ],
 "Location": [
  null,
  ""
 ],
 "Table with mount points": [
  null,
  ""
 ],
 "Add file system": [
  null,
  ""
 ],
 "Other": [
  null,
  ""
 ],
 "Reset to defaults": [
  null,
  ""
 ],
 "Partitions and file systems": [
  null,
  ""
 ],
 "Structure of the new system, including any additional partition needed for booting": [
  null,
  ""
 ],
 "Show partitions and file-systems actions": [
  null,
  ""
 ],
 "Hide %d subvolume action": [
  null,
  "",
  "",
  ""
 ],
 "Show %d subvolume action": [
  null,
  "",
  "",
  ""
 ],
 "Destructive actions are not allowed": [
  null,
  ""
 ],
 "Destructive actions are allowed": [
  null,
  ""
 ],
 "affecting": [
  null,
  ""
 ],
 "Shrinking partitions is not allowed": [
  null,
  ""
 ],
 "Shrinking partitions is allowed": [
  null,
  ""
 ],
 "Shrinking some partitions is allowed but not needed": [
  null,
  ""
 ],
 "%d partition will be shrunk": [
  null,
  "",
  "",
  ""
 ],
 "Cannot accommodate the required file systems for installation": [
  null,
  ""
 ],
 "Check the planned action": [
  null,
  "",
  "",
  ""
 ],
 "Waiting for actions information...": [
  null,
  ""
 ],
 "Planned Actions": [
  null,
  ""
 ],
 "Waiting for information about storage configuration": [
  null,
  ""
 ],
 "Final layout": [
  null,
  ""
 ],
 "The systems will be configured as displayed below.": [
  null,
  ""
 ],
 "Storage proposal not possible": [
  null,
  ""
 ],
 "New": [
  null,
  ""
 ],
 "Before %s": [
  null,
  ""
 ],
 "Mount Point": [
  null,
  ""
 ],
 "Transactional root file system": [
  null,
  ""
 ],
 "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.": [
  null,
  ""
 ],
 "Use Btrfs snapshots for the root file system": [
  null,
  ""
 ],
 "Allows to boot to a previous version of the system after configuration changes or software upgrades.": [
  null,
  ""
 ],
 "Up to %s can be recovered by shrinking the device.": [
  null,
  ""
 ],
 "The device cannot be shrunk:": [
  null,
  ""
 ],
 "Show information about %s": [
  null,
  ""
 ],
 "The content may be deleted": [
  null,
  ""
 ],
 "Action": [
  null,
  ""
 ],
 "Actions to find space": [
  null,
  ""
 ],
 "Space policy": [
  null,
  ""
 ],
 "Add %s file system": [
  null,
  ""
 ],
 "Edit %s file system": [
  null,
  ""
 ],
 "Edit file system": [
  null,
  ""
 ],
 "The type and size of the file system cannot be edited.": [
  null,
  ""
 ],
 "The current file system on %s is selected to be mounted at %s.": [
  null,
  ""
 ],
 "The size of the file system cannot be edited": [
  null,
  ""
 ],
 "The file system is allocated at the device %s.": [
  null,
  ""
 ],
 "A mount point is required": [
  null,
  ""
 ],
 "The mount point is invalid": [
  null,
  ""
 ],
 "A size value is required": [
  null,
  ""
 ],
 "Minimum size is required": [
  null,
  ""
 ],
 "There is already a file system for %s.": [
  null,
  ""
 ],
 "Do you want to edit it?": [
  null,
  ""
 ],
 "There is a predefined file system for %s.": [
  null,
  ""
 ],
 "Do you want to add it?": [
  null,
  ""
 ],
 "The options for the file system type depends on the product and the mount point.": [
  null,
  ""
 ],
 "More info for file system types": [
  null,
  ""
 ],
 "File system type": [
  null,
  ""
 ],
 "the configuration of snapshots": [
  null,
  ""
 ],
 "the presence of the file system for %s": [
  null,
  ""
 ],
 ", ": [
  null,
  ""
 ],
 "the amount of RAM in the system": [
  null,
  ""
 ],
 "The final size depends on %s.": [
  null,
  ""
 ],
 " and ": [
  null,
  ""
 ],
 "Automatically calculated size according to the selected product.": [
  null,
  ""
 ],
 "Exact size for the file system.": [
  null,
  ""
 ],
 "Exact size": [
  null,
  ""
 ],
 "Size unit": [
  null,
  ""
 ],
 "Limits for the file system size. The final size will be a value between the given minimum and maximum. If no maximum is given then the file system will be as big as possible.": [
  null,
  ""
 ],
 "Minimum": [
  null,
  ""
 ],
 "Minimum desired size": [
  null,
  ""
 ],
 "Unit for the minimum size": [
  null,
  ""
 ],
 "Maximum": [
  null,
  ""
 ],
 "Maximum desired size": [
  null,
  ""
 ],
 "Unit for the maximum size": [
  null,
  ""
 ],
 "Auto": [
  null,
  ""
 ],
 "Fixed": [
  null,
  ""
 ],
 "Range": [
  null,
  ""
 ],
 "The file systems are allocated at the installation device by default. Indicate a custom location to create the file system at a specific device.": [
  null,
  ""
 ],
 "Location for %s file system": [
  null,
  ""
 ],
 "Select in which device to allocate the file system": [
  null,
  ""
 ],
 "Select a location": [
  null,
  ""
 ],
 "Select how to allocate the file system": [
  null,
  ""
 ],
 "Create a new partition": [
  null,
  ""
 ],
 "The file system will be allocated as a new partition at the selected   disk.": [
  null,
  ""
 ],
 "Create a dedicated LVM volume group": [
  null,
  ""
 ],
 "A new volume group will be allocated in the selected disk and the   file system will be created as a logical volume.": [
  null,
  ""
 ],
 "Format the device": [
  null,
  ""
 ],
 "The selected device will be formatted as %s file system.": [
  null,
  ""
 ],
 "Mount the file system": [
  null,
  ""
 ],
 "The current file system on the selected device will be mounted   without formatting the device.": [
  null,
  ""
 ],
 "Usage": [
  null,
  ""
 ],
 "Formatting DASD devices": [
  null,
  ""
 ],
 "DASD": [
  null,
  ""
 ],
 "DASD devices selection table": [
  null,
  ""
 ],
 "Back to device selection": [
  null,
  ""
 ],
 "No": [
  null,
  ""
 ],
 "Yes": [
  null,
  ""
 ],
 "Channel ID": [
  null,
  ""
 ],
 "Status": [
  null,
  ""
 ],
 "Type": [
  null,
  ""
 ],
 "DIAG": [
  null,
  ""
 ],
 "Formatted": [
  null,
  ""
 ],
 "Partition Info": [
  null,
  ""
 ],
 "Cannot format all selected devices": [
  null,
  ""
 ],
 "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again": [
  null,
  ""
 ],
 "Format selected devices?": [
  null,
  ""
 ],
 "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.": [
  null,
  ""
 ],
 "Perform an action": [
  null,
  ""
 ],
 "Activate": [
  null,
  ""
 ],
 "Deactivate": [
  null,
  ""
 ],
 "Set DIAG On": [
  null,
  ""
 ],
 "Set DIAG Off": [
  null,
  ""
 ],
 "Format": [
  null,
  ""
 ],
 "Filter by min channel": [
  null,
  ""
 ],
 "Remove min channel filter": [
  null,
  ""
 ],
 "Filter by max channel": [
  null,
  ""
 ],
 "Remove max channel filter": [
  null,
  ""
 ],
 "DASDs table section": [
  null,
  ""
 ],
 "Unused space": [
  null,
  ""
 ],
 "Only available if authentication by target is provided": [
  null,
  ""
 ],
 "Authentication by target": [
  null,
  ""
 ],
 "User name": [
  null,
  ""
 ],
 "Incorrect user name": [
  null,
  ""
 ],
 "Incorrect password": [
  null,
  ""
 ],
 "Authentication by initiator": [
  null,
  ""
 ],
 "Target Password": [
  null,
  ""
 ],
 "Discover iSCSI Targets": [
  null,
  ""
 ],
 "Make sure you provide the correct values": [
  null,
  ""
 ],
 "IP address": [
  null,
  ""
 ],
 "Address": [
  null,
  ""
 ],
 "Incorrect IP address": [
  null,
  ""
 ],
 "Port": [
  null,
  ""
 ],
 "Incorrect port": [
  null,
  ""
 ],
 "Edit %s": [
  null,
  ""
 ],
 "Edit iSCSI Initiator": [
  null,
  ""
 ],
 "Initiator name": [
  null,
  ""
 ],
 "iBFT": [
  null,
  ""
 ],
 "Offload card": [
  null,
  ""
 ],
 "Initiator": [
  null,
  ""
 ],
 "Login %s": [
  null,
  ""
 ],
 "Startup": [
  null,
  ""
 ],
 "On boot": [
  null,
  ""
 ],
 "Connected (%s)": [
  null,
  ""
 ],
 "Login": [
  null,
  ""
 ],
 "Logout": [
  null,
  ""
 ],
 "Portal": [
  null,
  ""
 ],
 "Interface": [
  null,
  ""
 ],
 "No iSCSI targets found.": [
  null,
  ""
 ],
 "Please, perform an iSCSI discovery in order to find available iSCSI targets.": [
  null,
  ""
 ],
 "Discover iSCSI targets": [
  null,
  ""
 ],
 "Discover": [
  null,
  ""
 ],
 "Targets": [
  null,
  ""
 ],
 "KiB": [
  null,
  ""
 ],
 "MiB": [
  null,
  ""
 ],
 "GiB": [
  null,
  ""
 ],
 "TiB": [
  null,
  ""
 ],
 "PiB": [
  null,
  ""
 ],
 "Delete current content": [
  null,
  ""
 ],
 "All partitions will be removed and any data in the disks will be lost.": [
  null,
  ""
 ],
 "deleting current content": [
  null,
  ""
 ],
 "Shrink existing partitions": [
  null,
  ""
 ],
 "The data is kept, but the current partitions will be resized as needed.": [
  null,
  ""
 ],
 "shrinking partitions": [
  null,
  ""
 ],
 "Use available space": [
  null,
  ""
 ],
 "The data is kept. Only the space not assigned to any partition will be used.": [
  null,
  ""
 ],
 "without modifying any partition": [
  null,
  ""
 ],
 "Custom": [
  null,
  ""
 ],
 "Select what to do with each partition.": [
  null,
  ""
 ],
 "with custom actions": [
  null,
  ""
 ],
 "Auto LUNs Scan": [
  null,
  ""
 ],
 "Activated": [
  null,
  ""
 ],
 "Deactivated": [
  null,
  ""
 ],
 "zFCP Disk Activation": [
  null,
  ""
 ],
 "zFCP Disk activation form": [
  null,
  ""
 ],
 "The zFCP disk was not activated.": [
  null,
  ""
 ],
 "WWPN": [
  null,
  ""
 ],
 "LUN": [
  null,
  ""
 ],
 "Automatic LUN scan is [enabled]. Activating a controller which is       running in NPIV mode will automatically configures all its LUNs.": [
  null,
  ""
 ],
 "Automatic LUN scan is [disabled]. LUNs have to be manually       configured after activating a controller.": [
  null,
  ""
 ],
 "Please, try to activate a zFCP disk.": [
  null,
  ""
 ],
 "Please, try to activate a zFCP controller.": [
  null,
  ""
 ],
 "No zFCP disks found.": [
  null,
  ""
 ],
 "Activate zFCP disk": [
  null,
  ""
 ],
 "Activate new disk": [
  null,
  ""
 ],
 "Disks": [
  null,
  ""
 ],
 "Controllers": [
  null,
  ""
 ],
 "No zFCP controllers found.": [
  null,
  ""
 ],
 "Read zFCP devices": [
  null,
  ""
 ],
 "Define a user now": [
  null,
  ""
 ],
 "No user defined yet.": [
  null,
  ""
 ],
 "Please, be aware that a user must be defined before installing the system to be able to log into it.": [
  null,
  ""
 ],
 "Full name": [
  null,
  ""
 ],
 "Username": [
  null,
  ""
 ],
 "Discard": [
  null,
  ""
 ],
 "First user": [
  null,
  ""
 ],
 "Username suggestion dropdown": [
  null,
  ""
 ],
 "Use suggested username": [
  null,
  ""
 ],
 "All fields are required": [
  null,
  ""
 ],
 "Create user": [
  null,
  ""
 ],
 "Edit user": [
  null,
  ""
 ],
 "User full name": [
  null,
  ""
 ],
 "Edit password too": [
  null,
  ""
 ],
 "user autologin": [
  null,
  ""
 ],
 "Auto-login": [
  null,
  ""
 ],
 "No root authentication method defined yet.": [
  null,
  ""
 ],
 "Please, define at least one authentication method for logging into the system as root.": [
  null,
  ""
 ],
 "Method": [
  null,
  ""
 ],
 "Already set": [
  null,
  ""
 ],
 "Not set": [
  null,
  ""
 ],
 "SSH Key": [
  null,
  ""
 ],
 "Set": [
  null,
  ""
 ],
 "Root authentication": [
  null,
  ""
 ],
 "Set a password": [
  null,
  ""
 ],
 "Upload a SSH Public Key": [
  null,
  ""
 ],
 "Change the root password": [
  null,
  ""
 ],
 "Set a root password": [
  null,
  ""
 ],
 "Edit the SSH Public Key for root": [
  null,
  ""
 ],
 "Add a SSH Public Key for root": [
  null,
  ""
 ],
 "Root password": [
  null,
  ""
 ],
 "Set root SSH public key": [
  null,
  ""
 ],
 "Root SSH public key": [
  null,
  ""
 ],
 "Upload, paste, or drop an SSH public key": [
  null,
  ""
 ],
 "Upload": [
  null,
  ""
 ],
 "Clear": [
  null,
  ""
 ],
 "ZFCP": [
  null,
  ""
 ]
});
