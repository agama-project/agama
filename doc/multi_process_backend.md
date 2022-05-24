## Multi Process Backend

It is attempt to have backend consisting of several dbus services that communicates between.
The goal of attempt is to verify that having separate services can speed up probing phase and maybe even slightly installation one.
The secondary goal is to have smaller dbus services that can be easier to reuse and have more formal API in between.
When considering threads versus separate processes, the choice pick was for processes, because threads is known to cause several issues to yast and also it is easier to avoid race condition using processes. And we also already use dbus for process communication.

### POC

When thinking about POC initial thought was to pick storage as it has very limited set of dependencies, but for POC it is needed both side of communication -> into process and out of process. And sadly storage-ng API is so rich and bootloader use quite big part of it, so having all of it exposed on DBUS makes it hard. So picked part which should be easy in context of dinstaller is users. Reasons are

1. users is also new enough, so code well covered
2. other parts of dinstaller do not use users

So it needs just to be sure that users communication goes over dbus with other parts of YaST that is used in DInstaller.
The most important ones are software and storage because both has lock on process ID, so another dbus process cannot get it.

Found dependencies of users:

- MailAliases ( depends on MailTable ) and other parts of dinstall does not depend on it. So no action is needed.
- ShadowConfig that uses CFA to modify login.defs which is used also from Security. Looks like Security is not used in other parts of d-installer. Even transitively.
- Autologin that uses many modules including packages which can be tricky. It basically checks which of supported Display Managers are available.
- ProductFeatures which should be in dinstaller replaced by Config. Which can mean that each process needs to evaluate dinstaller config. Ignored in POC for now.

What was agreed:

- for POC it uses Y2DIR with modified dependent modules that uses dbus to provide info. It is now located at `service/lib/dinstaller/dbus/y2dir` where is modified yast sources
- Having `DInstaller::DBus::Clients for dbus clients that is needed to communicate between different processes.

### Future steps

- For questions we agreed that it should be separate DBus services that have two APIs - one for Clients that discover new questions and reply to them and one for Services which asks questions and then get notified that result is available.
- The next step is to have separate service for Software as it can have the biggest impact due to its slow probe and installation. So we can do next evaluation when we have it and do software probing asynchronous.
