## Sys Crate for Agama Zypp

Low level FFI bindings to agama-zypp c layer.

How to regenerate bindings ( using bindgen-cli ):

```
bindgen --merge-extern-blocks headers.h -o src/bindings.rs -- -I../../c-layer/include
```
