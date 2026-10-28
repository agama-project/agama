# Product definitions

This directory contains product definitions for the Agama installer.

## Notes

### *os-prober* Package

In SLE 16.1, if the *os-prober* package is added to the product configuration as either a mandatory
or optional package, then *yast-bootloader* will configure it to detected other operating systems
installed on the machine and add them to the boot menu.

This solution has a drawback: the package *os-prober* might be installed even if not needed, for
example for *grub2-bls*. A better solution will be implemented for SLE 16.2.

## Contribution

For updating the translations use the [Agama Weblate
project](https://l10n.opensuse.org/projects/agama/agama-products-master/). The changes
in the Weblate are automatically saved to the
[agama-weblate](https://github.com/agama-project/agama-weblate/tree/master/products) repository
and later a pull request with the changes is automatically created for merging
the changes here.

Alternatively you can open a pull request against the
[agama-weblate](https://github.com/agama-project/agama-weblate/tree/master/products) GitHub
repository. But that requires manual approving and merging, prefer using the
Weblate tool, it merges automatically.
