# Agama YaST

According to [Agama's architecture](../doc/architecture.md) this project implements the following components:

* The *Agama YaST*, the layer build on top of YaST functionality.

## Testing Changes

The easiest way to test changes done to Ruby code on Agama live media is to build
the gem with modified sources with `gem build agama-yast`. Then copy the resulting file
to Agama live image. Then run this sequence of commands:

```sh
# ensure that only modified sources are installed
gem uninstall agama-yast
# install modified sources including proper binary names
gem install --no-doc --no-format-executable <path to gem>
```

If the changes modify the D-Bus part, then restart related D-Bus services.

