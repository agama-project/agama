

## File Names

**`*.doc.xml`**: documentation authored by humans in the `<doc:*>` tags

`tmp/`**`*.ref.xml`**: intermediate, produced from `*.doc.xml`, contains DocBook
"**ref**entry"

`../dist/dbus/`**`*.ref.html`**: rendered for publishing on GitHub Pages

`bus/`**`*.bus.xml`**: output of D-Bus introspection

`tmp/`**`*.iface.xml`**: intermediate, simplified `*.doc.xml` and `*.bus.xml`
to leave the common parts for diffing, see `make diff`.

