# D-Bus API Reference

## General Principles

### Objects versus dict/struct/etc

There was discussion if it is better to use in API basic types enclosed in data structures
or if we should enclose as much as possible data to own objects that have
own properties and methods. We see advantages and disadvantages for both approaches.
So we decide to:

- use simple data for simple data (like list of languages)
- for more complex data (like storage configuration) use objects.

We can revisit decision in future.
For decision if it is simple or complex we decide for rule, that data should
contain *only one level of nesting of dict/struct*. So struct of structs or dictionary with dictionaries or structs
should be prevented and instead use for that struct or dictionary object.

### Localization

We also discuss approach how to solve localization of some strings like language human names,
error messages from some scripts or strings from libraries.
Setting locale for whole service is basically discouraged as there can be multiple clients
working with given service, e.g. some log collector beside user doing setup.
So we decided for now to

- have properties in English
- when locale is needed then a dedicated call to get
localized strings together with locale should be used.

Methods that can return localized error states
should be able to get as option requested locale.

### Resources

We use these resources to get more familiar with D-Bus API designing.

- D-Bus API design guidelines https://dbus.freedesktop.org/doc/dbus-api-design.html
- PackageKit design https://www.freedesktop.org/software/PackageKit/gtk-doc/api-reference.html
- udisks design http://storaged.org/doc/udisks2-api/2.6.4/ch02.html
- network manager design https://people.freedesktop.org/~lkundrak/nm-docs/spec.html
- anakonda D-Bus API ( spread in `*_interface.py` files https://github.com/rhinstaller/anaconda/tree/master/pyanaconda/modules

## Language

Iface: o.o.Agama1.Locale

See the new-style [reference][lang-ref] ([source][lang-src]).

[lang-ref]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama1.Locale.html
[lang-src]: dbus/org.opensuse.Agama1.Locale.doc.xml

## Base Product

Iface: o.o.Agama.Software1

See the new-style [reference][lang-ref] ([source][lang-src]).

[lang-ref]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama.Software1.html
[lang-src]: dbus/org.opensuse.Agama.Software1.doc.xml

## `org.opensuse.Agama.Storage1` Service

Service for managing storage devices.

### Overview

~~~
/Agama/Storage1
  .ObjectManager
  .Agama1.ServiceStatus
  .Agama1.Progress
  .Agama.Storage1
  .Agama.Storage1.Proposal.Calculator
  .Agama.Storage1.ISCSI.Initiator
  .Agama.Storage1.DASD.Manager (Only available on s390 systems)
/Agama/Storage1/Proposal
  .Agama.Storage1.Proposal
/Agama/Storage1/iscsi_nodes/[0-9]+
  .Agama.Storage1.ISCSI.Node
/Agama/Storage1/dasds/[0-9]+ (Only available on s390 systems)
  .Agama.Storage1.DASD.device
/Agama/Storage1/jobs/[0-9]+
  .Agama.Storage1.Job
  .Agama.Storage1.DASD.Format
~~~

### D-Bus Objects

#### `/org/opensuse/Agama/Storage1` Object

~~~
/Agama/Storage1
  .ObjectManager
  .Agama1.ServiceStatus
  .Agama1.Progress
  .Agama.Storage1
  .Agama.Storage1.Proposal.Calculator
  .Agama.Storage1.ISCSI.Initiator
  .Agama.Storage1.DASD.manager
~~~

Main object exported by the service `org.opensuse.Agama1`. This object implements the `org.freedesktop.DBus.ObjectManager` interface and should be used by clients to discover other objects.

This object also implements generic interfaces to manage the service status, progress and validation.

Moreover, it implements interfaces to manipulate the global state (perform installation, create proposals, login sessions for iSCSI nodes, etc).

#### `/org/opensuse/Agama/Storage1/Proposal` Object

~~~
/Agama/Storage1/Proposal
  .Agama.Storage1.Proposal
~~~

This object is exported only if a proposal was already calculated (successful or not). It can be used to inspect the result of the calculated proposal.

#### `/org/opensuse/Agama/Storage1/iscsi_nodes/[0-9]+` Objects

~~~
/Agama/Storage1/iscsi_nodes/[0-9]+
  .Agama.Storage1.ISCSI.Node
~~~

Objects representing iSCSI nodes are dynamically exported when a successful iSCSI discovery is performed, see `.org.opensuse.Agama.Storage1.ISCSI.Initiator` interface.

#### `/org/opensuse/Agama/Storage1/dasds/[0-9]+` Objects

~~~
/Agama/Storage1/dasds/[0-9]+
  .Agama.Storage1.DASD.Device
~~~

Objects representing DASDs are dynamically exported when a successful probing is performed by the `DASD.manager` interface of the main storage object, see `.org.opensuse.Agama.Storage1.DASD.manager`.

#### `/org/opensuse/Agama/Storage1/jobs/[0-9]+` Objects

~~~
/Agama/Storage1/jobs/[0-9]+
  .Agama.Storage1.Job
  .Agama.Storage1.DASD.Format
~~~

Objects representing long-running processes, like formatting of DASDs.

### D-Bus Interfaces

#### `org.opensuse.Agama.Storage1` Interface

Offers methods for performing general installation actions.

##### Methods

~~~
Probe()
Install()
Finish()
~~~

##### Properties

~~~
DeprecatedSystem  readable  b
~~~

#### `org.opensuse.Agama.Storage1.Proposal.Calculator` Interface

Allows creating a storage proposal.

##### Methods

~~~
Calculate(in  a{sv} settings,
          out u     result)
~~~

##### Properties

~~~
AvailableDevices  readable  a(ssa{sv})
VolumeTemplates   readable  aa{sv}
Result            readable  o
~~~

##### Details

###### `Calculate` method

~~~
Calculate(in  a{sv} settings,
          out u     result)
~~~

Calculates a new proposal with the given settings. A proposal object is exported when the proposal is calculated.

Arguments:

* `in a{sv} settings`: Allowed settings correspond to the properties defined by `org.opensuse.Agama.Storage1.Proposal` interface.
* `out u result`: `0` on success and `1` on failure.

###### `AvailableDevices` Property

~~~
AvailableDevices  readable a(ssa{sv})
~~~

Array in which each element has a device name, description, and extra data.

Example: `1 "/dev/sda" "/dev/sda, 8.00 GiB, USB" 0`

Extra data is not used yet.

###### `VolumeTemplates` Property

~~~
VolumeTemplates   readable aa{sv}
~~~

Templates that can be used as starting point for the volumes of a new proposal. See `Volumes` property from `org.opensuse.Agama.Storage1.Proposal` interface.

###### `Result` Property

~~~
Result            readable  o
~~~

Path of the object with the proposal result, typically `/org/opensuse/Agama/Storage1/Proposal`. If there is no proposal exported yet, then the path points to root `/`.

#### `org.opensuse.Agama.Storage1.Proposal` Interface

Information about the calculated storage proposal.

##### Properties

~~~
CandidateDevices    readable as
LVM                 readable b
EncryptionPassword  readable s
Volumes             readable aa{sv}
Actions             readable aa{sv}
~~~

##### Details

###### `Volumes` Property

~~~
Volumes             readable aa{sv}
~~~

List of volumes used for calculating the proposal.

Each volume is defined by the following properties:

~~~
DeviceType                s
Optional                  b
Encrypted                 b
MountPoint                s
FixedSizeLimits           b
AdaptiveSizes             b
MinSize                   x
MaxSize                   x
FsTypes                   as
FsType                    s
Snapshots                 b
SnapshotsConfigurable     b
SnapshotsAffectSizes      b
SizeRelevantVolumes       as
~~~

Example:

~~~
1 14 DeviceType s "partition" Optional b false Encrypted b false MountPoint s / FixedSizeLimit b false AdaptiveSizes b false MinSize x 1024 MaxSize x 2048 FsTypes as 3 Btrfs XFS EXT4 FsType Btrfs Snapshots b true SnapshotsConfigurable b true SnapshotsAffectSizes b false VolumeWithFallbackSizes as 1 /home
~~~

###### `Actions` Property

~~~
Actions             readable aa{sv}
~~~

Actions to perform in the system to create the proposal. If the proposal failed, then the list of actions is empty.

Each action is defined by the following properties:

~~~
Text    readable s
Subvol  readable b
Delete  readable b
~~~

Example:

~~~
2 3 Text s "Create partition /dev/vdb1" Subvol b false Delete b false 3 Text s "Delete Btrfs subvolume @/var" Subvol b true Delete b true
~~~

#### `org.opensuse.Agama.Storage1.ISCSI.Initiator` Interface

Provides methods for configuring iSCSI initiator and for discovering nodes.

##### Methods

~~~
Discover(in  s       address,
         in  u       port,
         in  a{sv}   options,
         out u       result)
Delete(in o  iscsi_node_path,
       out u result)
~~~

##### Properties

~~~
InitiatorName readable,writable   s
~~~

##### Details

###### `Discover` Method

~~~
Discover(in  s       address,
         in  u       port,
         in  a{sv}   options,
         out u       result)
~~~

Performs nodes discovery. Discovered nodes are exported with the path `/org/opensuse/Agama/iscsi_nodes/[0-9]+`.

Arguments:

* `in s address`: IP address of the iSCSI server.
* `in u port`: Port of the iSCSI server.
* `in a{sv} options`:
  * `Username s`: Username for authentication by target.
  * `Password s`: Password for authentication by target.
  * `ReverseUsername s`: Username for authentication by initiator.
  * `ReversePassword s`: Password for authentication by initiator.
* `out u result`: `0` on success and `1` on failure.

##### `Delete` Method

~~~
Delete(in o  iscsi_node_path,
       out u result)
~~~

Deletes a discovered iSCSI node. The iSCSI node object is not exported. Note that connected nodes cannot be deleted.

Arguments:

* `in o iscsi_node_path`: Path of the iSCSI node to delete.
* `out u result`: `0` on success and `1` on failure if the given node is not exported, `2` on failure because any other reason.

#### `org.opensuse.Agama.Storage1.ISCSI.Node` Interface

This interface is implemented by objects exported at `/org/opensuse/Agama/Storage1/iscsi_nodes/[0-9]+` path. It provides information about an iSCSI node and allows to perform login and logout.

##### Methods

~~~
Login(in  a{sv}   options,
      out u       result)
Logout(out u result)
~~~

##### Properties

~~~
Target    readable          s
Address   readable          s
Port      readable          u
Interface readable          s
IBFT      readable          b
Connected readable          b
Startup   readable,writable s
~~~

##### Details

###### `Login` Method

~~~
Login(in  a{sv}   options,
      out u       result)
~~~

Creates an iSCSI session. If the session is created, the corresponding object at the path
`/org/opensuse/Agama/Storage1/iscsi_nodes/[0-9]+` is updated.

Arguments:

* `in a{sv} options`:
  * `Username s`: Username for authentication by target.
  * `Password s`: Password for authentication by target.
  * `ReverseUsername s`: Username for authentication by initiator.
  * `ReversePassword s`: Password for authentication by initiator.
  * `Startup s`: startup mode (`manual`, `onboot`, `automatic`).
* `out u result`: `0` on success, `1` on failure if the given startup value is not valid, and `2` on failure because any other reason.

###### `Logout` Method

~~~
Logout(out u result)
~~~

Closes an iSCSI session.

Arguments:

* `out u result`: `0` on success and `1` on failure.

#### `org.opensuse.Agama.Storage1.DASD.Manager` Interface

Provides methods for configuring DASDs. It's only available if the D-Bus service is running on a
s390x system.

##### A Note About DIAG and YaST

The `use_diag` flag of a given DASD controls whether it should use the DIAG access method.
Traditionally YaST has managed that flag in a way that may be confusing to newcomers. Nevertheless,
for the sake of consistency and easy transition (and also to reuse some YaST components without
modifications) Agama observes that YaST approach. In a nutshell:

- When the list of DASDs is read from the system (see method `Probe()`), the value of the `use_diag`
  flag for enabled devices is checked from the system and exported with the proper value in the D-Bus
  representation of the DASD. But for disabled DASDs, the value of the flag is always assumed to be
  false.
- When the value of the `use_diag` flag is changed for an enabled device using the D-Bus interface
  (see method `SetDiag()`), the change is applied immediately to the system, disabling the device
  and enabling it again with the new access method.
- When the value of the flag is changed for a disabled device, the flag is updated in the D-Bus
  representation of the DASD but not written to the system configuration. The change will only
  have effect in the system if the device is enabled afterwards using the `Enable()` method. The
  change is lost if `Probe()` is called again without having enabled the device.

##### Methods

~~~
Probe()
Enable(in  ao devices,
       out u  result)
Disable(in  ao devices,
        out u  result)
SetDiag(in  ao devices,
        in  b  diag,
        out u  result)
Format(in  ao devices,
       out u  result,
       out o  job)
~~~

##### Details

###### `Probe` Method

Finds DASDs in the system. Found DASDs are exported with the path
`/org/opensuse/Agama/Storage1/dasds/[0-9]+`.

###### `Enable` Method

~~~
Enable(in  ao devices,
       out u  result)
~~~

Enables the given list of DASDs. See documentation above to understand how the `use_diag` flag of
the DASDs is affected by this method.

Arguments:

* `in ao devices`: paths of the D-Bus objects representing the DASDs to enable.
* `out u result`: `0` if all DASDs are successfully enabled. `1` if any of the given paths is invalid (ie. it does not correspond to a known DASD), `2` in case of any other error.


###### `Disable` Method

~~~
Disable(in  ao devices,
        out u  result)
~~~

Disables the given list of DASDs.

Arguments:

* `in ao devices`: paths of the D-Bus objects representing the DASDs to disable.
* `out u result`: `0` if all DASDs are successfully disabled. `1` if any of the given paths is invalid (ie. it does not correspond to a known DASD), `2` in case of any other error.

###### `SetDiag` Method

~~~
SetDiag(in  ao devices,
        in  b  diag,
        out u  result)
~~~

Sets the `use_diag` attribute for the given DASDs to the given value. See documentation above to
understand what setting the flag really means (since this follows the same convention than YaST).

Arguments:

* `in ao devices`: paths of the D-Bus objects representing the DASDs to configure.
* `in b diag`: new value for the flag.
* `out u result`: `0` if `use_diag` is correctly set for all the requested DASDs. `1` if any of the given paths is invalid (ie. it does not correspond to a known DASD), `2` in case of any other error.

###### `Format` Method

~~~
Format(in  ao devices,
       out u  result,
       out o  job)
~~~

Starts a format process for the DASDs in the given list. It creates a job to represent such a
process.

Arguments:

* `in ao devices`: paths of the D-Bus objects representing the DASDs to format.
* `out u result`: `0` if the format operation starts correctly and the job to track it is created. `1` if any of the given paths is invalid (ie. it does not correspond to a known DASD), `2` in case of any other error.
* `out o job`: if the result is 0, path of the new job that can be used to track the formatting. Contains the string `/` (no job) if the result is not zero.

#### `org.opensuse.Agama.Storage1.DASD.Device` Interface

This interface is implemented by objects exported at the `/org/opensuse/Agama/Storage1/dasds/[0-9]+`
paths. It provides information about a DASD in the system.

##### Properties

~~~
Id            readable s
Enabled       readable b
DeviceName    readable s
Formatted     readable b
Diag          readable b
Type          readable s
Status        readable s
AccessType    readable s
PartitionInfo readable s
~~~

Bear in mind these properties are a quite direct translation of the attributes read and exposed by
YaST. Some changes may be introduced in the future to make them easier to consume (eg. the current
string `AccessType` could be replaced by a boolean `ReadOnly`).

* `Id`: The device channel id (eg. "0.0.0150")
* `Enabled`: Whether the device is enabled.
* `DeviceName`: Device name of the DASD in the linux system (eg. "/dev/dasda"). Empty string if the
  device is not enabled.
* `Formatted`: whether the device is formatted.
* `Diag`: Whether the DIAG access method is used (or will be used when the device is enabled).
* `Type`: The DASD type (eg. EKCD or FBA).
* `Status`: Device status according to lsdasd (eg. "offline", "active", "active(ro)")
* `AccessType`: Empty string if unknown. Either "rw" or "ro" otherwise.
* `PartitionInfo`: Partition names (and sometimes their type) separated by commas.
  Eg. "_/dev/dasda1 (Linux native), /dev/dasda2 (Linux native)_". Empty if the information is unknown.

#### `org.opensuse.Agama.Storage1.Job` Interface

This interface is implemented by objects exported at the `/org/opensuse/Agama/Storage1/jobs/[0-9]+`
paths. It provides information about a long-running process.

##### Properties

~~~
Running  readable b
ExitCode readable u
~~~

* `Running`: Whether the Job is still being executed or it has already finished.
* `ExitCode`: Final result. Zero for running processes.

##### Signals

* `Finished(u exit_code)`: the Job is not longer running and the exit code has been set to its final
  value.
* `PropertiesChanged()`: in parallel to the mentioned `Finished` signal, the standard
  `PropertiesChanged` signal from `org.freedesktop.DBus.Properties` is also triggered at the end of
  the job execution to reflect the corresponding changes in the properties.

#### `org.opensuse.Agama.Storage1.DASD.Format` Interface

This interface is implemented by those Job objects used to represent the formatting of a set of DASDs.

##### Properties

~~~
Summary readable a{s(uub)}
~~~

* `Summary`: A hash where each key is the path of one of the DASDs being formatted and the value is
  the status represented by a triplet of total cylinders, cylinders already processed and a boolean
  indicating whether the process for that particular disk is completed.

##### Signals

* `PropertiesChanged`, as standard from `org.freedesktop.DBus.Properties`.

## Users

See the new-style [reference][usr-ref] ([source][usr-src]).

[usr-ref]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama.Users1.html
[usr-src]: dbus/org.opensuse.Agama.Users1.doc.xml

## Manager

See the new-style [reference][mgr-ref] ([source][mgr-src]).

[mgr-ref]: https://opensuse.github.io/agama/dbus/ref-org.opensuse.Agama1.Manager.html
[mgr-src]: dbus/org.opensuse.Agama1.Manager.doc.xml
