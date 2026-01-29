# Xgettext Container

This directory contains the definition of a container containing the latest
version of the GNU gettext from the openSUSE Tumbleweed distribution.

It can be used for extracting the translatable texts from the web frontend.
That requires a newer GNU gettext which supports TSX input file format.

## Building the container

To build the container run the `./build.sh` script. It uses Podman so make sure
it is installed in the system.

## Using the container

To run the container use the `./xgettext.sh` script. All parameters are passed
to the `xgettext` tool inside the container.

## Clean up

If you do not need the container anymore you can delete the image:

```sh
podman rmi agama-xgettext
```

The container is based on the openSUSE Tumbleweed base image. If you do not use
it in other containers you can delete it as well:

```sh
podman rmi registry.opensuse.org/opensuse/tumbleweed:latest
```
