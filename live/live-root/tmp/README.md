# Helper Files

This directory contains some helper file which are needed when building the ISO
image. The files are deleted at the end of build and are not included in the
final image.

The [module.list](./module.list) file is copied from the installation-images
package. To update the file download the latest version from
https://github.com/openSUSE/installation-images/blob/master/etc/module.list.

Hot fixes or Agama specific changes should be added into the
[module.list.extra](./module.list.extra) file to keep the original file
untouched.
