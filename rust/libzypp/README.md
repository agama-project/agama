## Experimental bindings for libzypp glib

Goal of this crate is to provide direct rust bindings to libzypp to avoid long path over yast component system.

### Code Organization

- zypp-sys dir is low level unsafe libzypp bindings
- libzypp dir git submodule for glib branch of libzypp
- gir dir is gir submodule for gir tool on revision used for code generation
- gir-files dir is git submodule with directory with curated gir files ( see gir book for details )
- ./ is high level libzypp bindings

### Updating bindings

In general follow gir book. Ideally update gir submodule to master. Then regenerate zypp-sys,
then high level bindings and do not forget to also update documentation with `rustdoc-stripper`

### Resources

- gir book: https://gtk-rs.org/gir/book/introduction.html
- git submodules: https://git-scm.com/book/en/v2/Git-Tools-Submodules
