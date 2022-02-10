
## get the list of available languages

Iface: o.o.YaST.Installer1.Language

methods:

  ToInstall(array(string)) -> void
    Set list of languages to install
    Example:
      ToInstall(["cs_CZ", "de_DE"]) -> () # only lang codes from AvailableLanguages is supported

Properties (all read only):

  AvailableLanguages -> array(struct(string, string, dict(string, variant)))
    List of all available languages to install on target system.
    Example:
      AvailableLanguages -> [["cs_CZ", "Czech", {}]] # it is lang code, human readable lang name and dict for future extensions to provide more data

  MarkedForInstall -> array(string)
    List of languages to install. Same format as ToInstall

Signals:

  PropertiesChanged ( only standard one from org.freedesktop.DBus.Properties interface )


notes:

identifiers: maybe LanguageTag https://www.rubydoc.info/github/yast/yast-packager/master/LanguageTag
- move it to yast-yast2
- link to the standard from yard
- see https://tools.ietf.org/html/rfc4647 Matching of Language Tags
- see https://lists.opensuse.org/archives/list/yast-devel@lists.opensuse.org/message/D52PSZ7TRID2RVM6CE6K2C2RUNNGOS6Z/

## get the list of base products

Iface: o.o.YaST.Installer1.Software

methods:

  InstallProduct(string) -> void
    Set product for install.
    TODO: do we need version or arch or any other parameter? should we add generic dict(sv) to it?
    Example:
      InstallProduct("SLES") -> () # only name from available BaseProducts is supported

Properties (all read only):

  AvailableBaseProducts -> array(struct(string, string, dict(string, variant)))
    List of all available base product to install on target system.
    Note: List is sorted according to defined display order
    Example:
      AvailableBaseProducts -> [["SLES", "SUSE Linux Enterprise Server", {}]] # it is product name, human readable name and dict for future extensions to provide more data

  SelectedBaseProduct -> string
    Base product selected for installation. It is always defined.
    Example:
      SelectedBaseProduct -> "SLES" # only name from available BaseProducts is supported

Signals:

  PropertiesChanged ( only standard one from org.freedesktop.DBus.Properties interface )


## interact with the storage proposal

Iface: o.o.YaST.Installer1.Storage

methods:

  MarkForUse(array(object)) -> void
    set objects for use of installation. it means erase content of that devices
    example:
      MarkForUse([disk1,disk2partition2]) -> ()

  MarkForShrinking(array(object)) -> void
    set objects to allow shrink of them. it means keep content and reduce its free space.
    example:
      MarkForShrink([disk1,disk2partition2]) -> ()

Properties (all read only):

  Disks -> array(o.o.YaST.Installer1.Storage.Drive)  # an object_path whose object implements this interface
    List of all disks.
    Example:
      Disks -> [disk1, disk2]

  Partitions -> array(o.o.YaST.Installer1.Storage.Partition)
    List of all partitions.
    Example:
      Disks -> [disk1partition1, disk1partition2, disk2partition1]

  DevicesToUse -> array(o.o.YaST.Installer1.Storage.BlockDevice)
    Devices that will be fully used by installation
    Example:
      DevicesToUse -> [disk1,disk2partition2]

  DevicesToShrink -> array(o.o.YaST.Installer1.Storage.BlockDevice)
    Devices that will be shrinked to make space for installation
    Example:
      DevicesToShrink -> [disk1,disk2partition2]

Signals:

  PropertiesChanged ( only standard one from org.freedesktop.DBus.Properties interface )

Iface: o.o.YaST.Installer1.Storage.BlockDevice

Inspired by Udisks2.Block

Properties (all read only):

  Device -> string
    Block device name in /dev like "/dev/sda"

  Size -> uint64
    Size of devices in bytes

  ReadOnly -> boolean
    if device is read only

Iface: o.o.YaST.Installer1.Storage.BlockDevice

Inspired by Udisks2.Block

Properties (all read only):

  Device -> string
    Block device name in /dev like "/dev/sda"

  Size -> uint64
    Size of devices in bytes

  ReadOnly -> boolean
    if device is read only

Iface: o.o.YaST.Installer1.Storage.Drive

Inspired by Udisks2.Drive

Properties (all read only):

  Vendor -> string
    Vendor of device or empty string if not known like "Fujitsu"

  Model -> string
    Device model or empty string if not known

  Removable -> boolean
    if device is removable like usb sticks

  Partitions -> array(o.o.YaST.Installer1.Storage.Partition)
    partitions on given drive

Iface: o.o.YaST.Installer1.Storage.Partition

Inspired by Udisks2.Partition

Properties (all read only):

  Drive -> o.o.YaST.Installer1.Storage.Drive
    where partitions live


## TODO

Localization? using localized strings are in general discouraged as dbus service and dbus client can use different locale. But I see some usage
when it pass locale as parameter in methods. Should we use it where apply? Or keep it on frontend?
