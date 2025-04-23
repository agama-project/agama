#! /bin/sh

# Display only kernel errors and more severe messages on the console. This is
# equivalent of using "loglevel=4" boot option, but we cannot use it because it
# would be written also to the bootloader configuration in the installed system.
dmesg --console-level 4
