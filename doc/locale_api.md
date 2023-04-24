# Legacy-free Locale Service

> D-Installer currently have a separate Language service, although it's rather
> simplistic. It just allows to set the language of the installed system using
> Yast::Language.Set. And it's quite memory demanding for such an unimpressive
> task.

> That service would be a nice candidate to be rewritten from scratch with no
> dependencies on YaST or Ruby. It's small enough and could give us a good
> overview on how much can we save.

Original Plan:
1. take the systemd APIs as a sensible starting point.
2. deviate only where we add value

The problem with the original plan is that
the installer runs in one system (inst-sys, `/`)
and operates on another (target, `/mnt`) and we cannot use the full systemd
API. We may use `systemd-firstboot` instead but its API is much more limited.

## Localization

This design includes localized labels in the API. In other contexts that would
be a responsibility of the frontend, but here here the backend has the
information, provided by _langtable_.

(Languages, Territories and Timezones have localized names. Keyboards do not.)

(Possible alternative: still include localized labels, but in a supplemental
method while the main method only provides the IDs (and English labels))

## Proposal

A Proposal is what the installer proposes to the user
as settings to be applied to the target system.

For example, when selecting the "German (Germany)" locale,
the timezone will be proposed to "Europe/Berlin".

Design decision: put the proposal logic to the antecedent object, that is,
the Locale object will know how to change the Timezone object,
not the other way around (Timezone reacting to Locale value).

### Overriding the User's Choice?

<details>
<summary>
If setting the locale proposes the keyboard, what do we do if the user first
changes the keyboard and _then_ the locale?
</summary>

When Agama UI first shows up, it may show default choices like:

>  Locale: English (US), Keyboard: US

Then we change the locale to Czech, and the keyboard is adjusted automatically:

>  Locale: Czech, Keyboard: Czech

We tune the keyboard:

>  Locale: Czech, Keyboard: Czech (qwerty)

When we then change the locale, the keyboard could stay the same, as we have
already touched it:

>  Locale: German, Keyboard: Czech (qwerty)
</details>

### Simple Design: Always Repropose

We can easily afford throwing away the user's choice of keyboard layout and
simply set what we consider a good default for a newly set locale, because:

1. it is just one setting (as opposed to whole partitioning layout)
2. the change will be visible in the UI, I assume

### Detailed Design: Prioritize

But other cases may not be as simple, so here's a generic design:

All settings are wrapped in a `Priority<T>` generic type (an Enum in Rust),
meaning, what is the source and importance of the setting:
- `Machine(data)` means the system has proposed it
- `Human(data)` means the user has made the choice

In D-Bus, it is represented by wrapping the data in a struct, with a leading
byte* tagging the priority. For ease of recognition when watching bus traffic,
special numbers are used:
- `23` means Human, for the number of chromosome pairs
- `42` means Machine, as the famous Answer was given by Deep Thought, a machine

In the following dump, we see that the locale was set by the user and the
system has adjusted the keyboard.

```
node ...Agama/Locale1 {
  interface ...Agama.Locale1 {
    properties:
      readwrite (yas)   Locale = (23, ['cs_CZ.UTF-8', 'de_DE.UTF-8']);
      readwrite (y(ss)) X11Keyboard = (42, ('cz','qwerty));
  };
};
```

You may know a [similar settings in libzypp][resstatus] where it has 4 levels.

*: maybe this is a crazy optimization? I am not too opposed to use strings for
this on the bus.

[resstatus]: https://github.com/openSUSE/libzypp/blob/d441746c59f063b5d54833bfdebc48829b07feb5/zypp/ResStatus.h#L106


## Interfaces

### Language and Keyboard

- when setting the locale, adjust the proposed package selection and keyboard
  accordingly. And timezone.

The general design of the proposal layer is

- declarative, using read-write properties
- setting some properties will make changes in the proposal layer of other
  properties of other objects

I don't know: should the proposal be adjusted automatically as part of the property setter, or should it be explicit?

So here, setting `Locale` below will set also `VConsoleKeyboard` here and
  - Agama...Software...todo(...)
  - Agama...Timezone...todo(...)

For the first version of the API, let's keep things simple:

**LocaleType** is just one string, the value for the `LANG` variable, like
`"cs_CZ.UTF-8"`.

**VConsoleKeyboardType** is a string, for example
`"cz-qwerty"` or `"us"`.

`systemd-firstboot` only has an option for the console keymap, but we have a
way to propagate it to X11, see [bsc#1046436](https://bugzilla.suse.com/show_bug.cgi?id=1046436)

We don't expose the X11 keyboard, instead letting systemd do it via the
_convert_ parameter.

(The other systemd keyboard settings are X11Model and X11Options, we don't
have UI or data for that)

**FIXME:** _langtable_ on the other hand only deals with the X11 keyboards.
And legacy YaST has the console keyboard as the primary key. Must resolve this.

```
# this is gdbus syntax BTW
node /org/opensuse/Agama/Locale1 {
  interface org.opensuse.Agama.Locale1 {
    methods:
      ListLocales(
        out a(sss) id_english_native # [('cs_CZ.UTF-8', 'Czech', 'Čeština'),…]
      )
      # langtable has X11 keyboards and no localization of their labels
      ListX11Keyboards(
        out as    ids  # id like "layout(variant)"
      )

      # ProposeKeyboard(); # not needed? adjusted automatically, same object
      # Sets Agama/TimeDate1's Timezone (but not LocalRTC, that's for Storage to say?)
      ProposeTimeDate(); # different object but same service
      ProposeSoftware(); # different service

      Commit();
    properties:
      # NOTE: "as" has different meaning to systemd,
      # we have a list of LANG settings, 1st gets passed to systemd,
      # others affect package selection
      readwrite as   Locale = ['cs_CZ.UTF-8', 'de_DE.UTF-8'];
      readwrite s    VConsoleKeyboard = 'cz-qwerty';
  };
};
```

#### Systemd

<details>
<summary>
For reference, the systemd API for Locale(Language) and Keyboard is this:
</summary>

```
$ gdbus introspect -y -d org.freedesktop.locale1 -o /org/freedesktop/locale1
node /org/freedesktop/locale1 {
  interface org.freedesktop.locale1 {
    methods:
      SetLocale(in  as locale,
                in  b interactive);
      SetVConsoleKeyboard(in  s keymap,
                          in  s keymap_toggle,
                          in  b convert,
                          in  b interactive);
      SetX11Keyboard(in  s layout,
                     in  s model,
                     in  s variant,
                     in  s options,
                     in  b convert,
                     in  b interactive);
…
$ busctl --system introspect org.freedesktop.locale1 /org/freedesktop/locale1
(all properties are read-only and emit PropertiesChanged)
.Locale                 property  as    1 "LANG=en_US.UTF-8"
.VConsoleKeymap         property  s     "cz-lat2-us"
.VConsoleKeymapToggle   property  s     ""
.X11Layout              property  s     "cz,us"
.X11Model               property  s     "pc105"
.X11Options             property  s     "terminate:ctrl_alt_bksp,grp:shift_togg…
.X11Variant             property  s     "qwerty,basic"
```

</details>

### Timezone

(Using the `Priority<T>` design from above)

```
node /org/opensuse/Agama/TimeDate1 {
  interface org.opensuse.Agama.TimeDate1 {
    methods:
      ListTimezones(
        in  s     display_locale # "de_DE.UTF-8"
        out a(ss) id_label_pairs # [('Europe/Prague', 'Europa/Prag')]
      )
      # success? do we need a specific return value other than some Error?
      Commit();
    properties:
      readwrite (ys) Timezone = (42, 'Europe/Prague');
      readwrite (yb) LocalRTC = (42, false);
  };
};
```

#### Systemd

<details>
<summary>
For reference, the systemd API for Time and Timezone is this:
</summary>

(I find `gdbus` verbose output better for methods and `busctl` terse output
better for properties)

```
$ gdbus introspect -y -d org.freedesktop.timedate1 -o /org/freedesktop/timedate1                        
node /org/freedesktop/timedate1 { …
  interface org.freedesktop.timedate1 { …
    methods:
      SetTime(in  x usec_utc,
              in  b relative,
              in  b interactive);
      SetTimezone(in  s timezone,
                  in  b interactive);
      SetLocalRTC(in  b local_rtc,
                  in  b fix_system,
                  in  b interactive);
      SetNTP(in  b use_ntp,
             in  b interactive);
      ListTimezones(out as timezones);
…
$ busctl --system introspect org.freedesktop.timedate1 /org/freedesktop/timedate1
NAME                      TYPE      SIG  RESULT/VALUE     FLAGS
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

</details>
