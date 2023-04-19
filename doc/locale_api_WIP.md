
Note: ListFoo APIs combine the IDs and the translations. 
If it's easier to return just the IDs and ask for the translations separately,
let's use such different API.

### Locales

```
ListLocales(
  in  s     display_locale # "en_US.UTF-8"
  out a(ss) id_label_pairs
)

SetLocale(in s locale_id)
```

### Keyboards

```
ListX11Keyboards(
  in  s     display_locale # "en_US.UTF-8"
  out a(ss) id_label_pairs  # id like "layout(variant)"
)

SetX11Keyboard(in s kb_id)

X11KeyboardForLocale(
  in  s locale_id
  out s kb_id
)
```

### Timezones


```
ListTimezones(
  in  s     display_locale # "en_US.UTF-8"
  out a(ss) id_label_pairs
)

SetTimezone(in s tz_id)

TimezoneForLocale(
  in  s locale_id
  out s tz_id
)
```
