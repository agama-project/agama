# Legacy-free Locale Service

> D-Installer currently have a separate Language service, although it's rather
> simplistic. It just allows to set the language of the installed system using
> Yast::Language.Set. And it's quite memory demanding for such an unimpressive
> task.

> That service would be a nice candidate to be rewritten from scratch with no
> dependencies on YaST or Ruby. It's small enough and could give us a good
> overview on how much can we save.

Plan:
1. take the systemd APIs as a sensible starting point.
2. deviate only where we add value

### Language and Keyboard

#### Systemd

The systemd API for Locale(Language) and Keyboard is this:
(where the last boolean means Interactive, and the other boolean means Convert)

```
org.freedesktop.locale1 service
/org/freedesktop/locale1 object
NAME                    TYPE      SIG   RESULT/VALUE
org.freedesktop.locale1 interface -     -
.SetLocale              method    asb   -
.SetVConsoleKeyboard    method    ssbb  -
.SetX11Keyboard         method    ssssbb-
(all properties are read-only and emit PropertiesChanged)
.Locale                 property  as    1 "LANG=en_US.UTF-8"
.VConsoleKeymap         property  s     "cz-lat2-us"
.VConsoleKeymapToggle   property  s     ""
.X11Layout              property  s     "cz,us"
.X11Model               property  s     "pc105"
.X11Options             property  s     "terminate:ctrl_alt_bksp,grp:shift_togg…
.X11Variant             property  s     "qwerty,basic"
```

#### Design

Elementary Layer (lower)

- Just use the systemd API, don't add any API of our own

Proposal Layer (uppper)

- when setting the locale, adjust the proposed package selection and keyboard
  accordingly. And timezone.

Agama.locale1 interface (on Agama/Language1?)
- is a copy of freedesktop.locale1,
  forwarding to the elementary layer,
  and SetLocale does the additional work
  - Agama...Software...todo(...)
  - Agama.locale1.SetVConsoleKeyboard(...)
  - Agama.locale1.SetX11Keyboard(...)
  - Agama...Timezone...todo(...)

### Timezone

#### Systemd

```
$ busctl --system introspect org.freedesktop.timedate1 /org/freedesktop/timedate1
NAME                      TYPE      SIG  RESULT/VALUE     FLAGS
...
org.freedesktop.timedate1 interface -    -                -
.ListTimezones            method    -    as               -
.SetLocalRTC              method    bbb  -                -
.SetNTP                   method    bb   -                -
.SetTime                  method    xbb  -                -
.SetTimezone              method    sb   -                -
(properties are read only)
.CanNTP                   property  b    true             -
.LocalRTC                 property  b    false            emits-change
.NTP                      property  b    false            emits-change
.NTPSynchronized          property  b    false            -
.RTCTimeUSec              property  t    1681214874000000 -
.TimeUSec                 property  t    1681214874046139 -
.Timezone                 property  s    "Europe/Prague"  emits-change
```

"LocalRTC" means "is the local time zone used for the real time clock",
so it's !hwclock_in_UTC

#### Design

we will use
.ListTimezones
.SetLocalRTC
.SetTimezone
.LocalRTC
.Timezone
