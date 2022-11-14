# D-Bus API Document

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

We also discuss aproach how to solve localization of some strings like language human names,
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

Iface: o.o.YaST.Installer1.Language

#### methods:

-  ToInstall(array(string LangId)) -> void
    Set list of languages to install
    Example:

      ToInstall(["cs_CZ", "de_DE"]) -> () # only lang codes from AvailableLanguages is supported

#### Properties (all read only):

-  AvailableLanguages -> array(struct(string LangId, string LangLabel, dict(string, variant) details))
    List of all available languages to install on target system.
    Example:

      AvailableLanguages -> [["cs_CZ", "Czech", {}]] # it is lang code, human readable lang name and dict for future extensions to provide more data

-  MarkedForInstall -> array(string LangId)
    List of languages to install. Same format as ToInstall

#### Signals:

-  PropertiesChanged ( only standard one from org.freedesktop.DBus.Properties interface )


notes:

identifiers: maybe LanguageTag https://www.rubydoc.info/github/yast/yast-packager/master/LanguageTag
- move it to yast-yast2
- link to the standard from yard
- see https://tools.ietf.org/html/rfc4647 Matching of Language Tags
- see https://lists.opensuse.org/archives/list/yast-devel@lists.opensuse.org/message/D52PSZ7TRID2RVM6CE6K2C2RUNNGOS6Z/

## Base Product

Iface: o.o.YaST.Installer1.Software

#### methods:

-   SelectProduct(string ProductId) -> void
    Select product for installation.
    TODO: do we need version or arch or any other parameter? should we add generic dict(sv) to it?
    Example:

      InstallProduct("SLES") -> () # only name from available BaseProducts is supported

#### Properties (all read only):

-  AvailableBaseProducts -> array(struct(string ProductId, string ProductLabel, dict(string, variant) details))
    List of all available base product to install on target system.
    Note: List is sorted according to defined display order
    Example:

      AvailableBaseProducts -> [["SLES", "SUSE Linux Enterprise Server", {}]] # it is product name, human readable name and dict for future extensions to provide more data

-  SelectedBaseProduct -> string ProductId
    Base product selected for installation. It is always defined.
    Example:

      SelectedBaseProduct -> "SLES" # only name from available BaseProducts is supported

#### Signals:

-  PropertiesChanged ( only standard one from org.freedesktop.DBus.Properties interface )


## Storage

### org.opensuse.DInstaller.Storage1

#### Methods

- Probe -> void

- Install -> void

- Finish -> void

### org.opensuse.DInstaller.Proposal1

** Making space is not covered yet**

#### Properties

- AvailableDevices -> a(ssa{sv}) (r)
  e.g., ["/dev/sda", "/dev/sda, 8.00 GiB, USB", {}]

- CandidateDevices -> as (r)

- LVM -> b (r)

- EncryptionPassword -> s (r)

- VolumeTemplates -> aa{sv} (r)
  Struct keys and values: see Volumes

- Volumes -> aa{sv} (r)
  Struct keys and values:
  - DeviceType -> s
  e.g., "partition", "lvm_lv"
  - Optional -> b
  - Encrypted -> b
  - MountPoint -> s
  - FixedSizeLimits -> b
  - AdaptativeSizes -> b
  - MinSize -> s
  - MaxSize -> s
  - FsTypes -> as
    e.g., ["Btrfs", "XFS"]
  - FsType -> s
  - Snapshots -> b
  - SnapshotsConfigurable -> b
  - SnapshotsAffectSizes -> b
  - VolumesWithFallbackSizes -> as
    e.g., ["/home", "/var"]

- Actions -> aa{sv} (r)
  Struct keys and values:
  - Text -> s (r)
  - Subvol -> b (r)
  - Delete -> b (r)

#### Methods

- Calculate(aa{sv}) -> u (0 success, 1 fail)
  Calculates a new proposal with the given properties (see proposal properties).


## Users

### iface o.o.Installer1.Users

#### methods:

-  SetRootPassword(string value, boolean encrypted) -> void
    sets root password. If encrypted is set to true, it means that already encrypted password
    is send.
    example:

      SetRootPassword("test", false) -> ()

-  SetRootSSHKey(string value) -> void
    set root ssh public keys. Use empty string to unset it.
    example:

      SetRootSSHKey("idrsa long key") -> ()

- SetFirstUser(string FullName, string UserName, string Password, boolean AutoLogin, map AdditionalData) -> void
    sets one non root user after installation. FullName and UserName has to follow restrictions
    for respective passwd entry. To unset it use empty UserName.
    example:

      SetRootSSHKey("idrsa long key") -> ()

#### Properties (all read only):

- RootPasswordSet -> boolean
  whenever root password will be set by installer

- RootSSHKey -> string
  root public ssh key that can be used to login to machine
  Can be empty which means not set

- FirstUser -> struct( string FullName, string UserName, boolean AutoLogin, map AdditionalData)
  info about first user to set. if Username is empty, it means not set and other values can be ignored


## Questions

D-Installers offers a mechanism to communicate with clients. The D-Bus service exports a *Questions*
object that implements the *org.freedesktop.DBus.ObjectManager* interface. Individual questions are
dynamically exported in a tree under the */org/opensuse/DInstaller/Questions1* path, for example:

~~~
/org/opensuse/DInstaller/Questions1
  /org/opensuse/DInstaller/Questions1/1
  /org/opensuse/DInstaller/Questions1/2
  /org/opensuse/DInstaller/Questions1/4
~~~

Each D-Bus question implements its own set of interfaces, depending on the type of question. For
example, a generic question implements *org.opensuse.DInstaller.Question1*. And a question asking
for the activation of a LUKS device also implements *org.opensuse.DInstaller.Question.LuksActivation1*.
Questions can be "unexported" from the ObjectManager tree. The service typically unexports a question
when the question is answered.

### org.opensuse.DInstaller.Question1

#### Properties

- Id -> unsigned 32-bit integer (r)
  Question id. The question is exported at *root_path/id*.

- Text -> string (r)
  Text of the question. Clients show this text to the users.

- Options -> array(string) (r)
  Options for answering the question. The question only admits an option from the list as valid
  answer.

- DefaultOption -> string (r)
  Clients should offer this option as default option for answering the question.

- Answer -> string (rw)
  Answer for the question. Clients set an option as answer.

### org.opensuse.DInstaller.Question.LuksActivation1

#### Properties

- Password -> string (rw)
  Password provided to decrypt a LUKS device.

- Attempt -> unsigned 32-bit integer (r)
  Current attempt to decrypt the device. This value is useful for clients to know if the very same
  question is asked again (i.e., when the provided password did not work).


## ServiceStatus

Each service will have an status (*idle* or *busy*). The service should change its status to *busy*
when it is going to start an expensive tasks. The status should be set back to *idle* once the long
task is done.

The main object of a service implements the following interface:

### org.opensuse.DInstaller.ServiceStatus1

#### Properties

- All -> array(array(dict(string, variant))) (r)

  All possible statuses:
  ~~~
  [
    {"id" => 0, "label" => "idle"},
    {"id" => 1, "label" => "busy"}
  ]
  ~~~

- Current -> unsigned 32-bit integer (r)

  Id of the current status.


## Progress

The main object of a service implements the following interface:

### org.opensuse.DInstaller.Progress1

- TotalSteps: unsigned 32-bit integer (r)
  Number of steps.

- CurrentStep: struct(unsigned 32-bit integer, string) (r)
  Number of the current step and its description.

- Finished: b (r)
  Whether the progress has finished.

## Manager

### Installation Phases

The installation process follows a set of phases. Only the main service (`DInstaller::Manager`)
knows the information about the current installation phase. The rest of services will act as utility
services without any knowledge about the whole installation process.

A client (e.g., a web UI) will ask to the main service for the current phase of the installation.

In principle, the installation will follow 3 possible phases: *Startup*, *Config* and *Install*.

* *Startup* Phase

This is the initial phase. The manager service will start in this phase and it will not change to
another phase until the client asks for performing the next phase.

* *Config* Phase

The installation is configured during this phase. Configuring the installation means that everything
needed from the system is read and the required default proposal are calculated. In YaST terms, the
*config* phase implies to probe some modules like storage, language, etc, and to perform their
proposals. Note that not all modules have to be probed/proposed. Probing some modules could be
delayed to the next *install* phase.

* *Install* Phase

This phase implies to perform everything to install the system according to the selected options and
proposals. Note that this phase is not only a typical YaST commit. For example, some proposals
(software?) could be done during this phase. In short, at the beginning of this phase we have all
the required information to perform the installation, and at the end of the phase the system is
installed.

### Status of the Services

Note that the services are blocked meanwhile they are performing a long task. For this
reason, the *manager* service will store the status of each service and the clients will ask to
*manager* to know that status.

### org.opensuse.DInstaller.Manager1

#### Properties

- InstallationPhases -> array(array(dict(string, variant))) (r)

  All possible phases:
~~~
  [
    {"id" => 0, "label" => "startup"},
    {"id" => 1, "label" => "config"},
    {"id" => 2, "label" => "install"}
  ]
~~~

- CurrentInstallationPhase -> unsigned 32-bit integer (r)

  Id of the current phase.

- BusyServices -> a(s) (r)

  List of names of the currently busy services.