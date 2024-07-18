# Agama YaST

According to [Agama's architecture](../doc/architecture.md) this project implements the following components:

* The *Agama YaST*, the layer build on top of YaST functionality.

## Testing Changes

The easiest way to test changes done to ruby code on agama liveCD is to build
gem with modified sources with `gem build agama-yast`. Then copy resulting file
to agama live ISO. There do this sequence of commands:

```sh
# ensure that only modified sources are installed
gem uninstall agama-yast
# install modified sources including proper binary names
gem install --no-doc --no-format-executable <path to gem>
```

If change modifies also dbus parts, then restart related dbus services.

