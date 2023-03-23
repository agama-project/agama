# Autoinstallation Support for DInstaller

## Intro

There is always need for automatic installation for easily reproducable unattended mass deployment. Goal for
DInstaller is to offer user options that fits his needs. Basically we see three main use cases which is
then represented by different formats. The first one is simply data provision that provide installer with
exact options to use. The second one is need for some dynamic adjustments based on conditions like hardware, network location and so on.
The third one is used when DInstaller does not provide all it is needed and some manual tweaking is needed before or after each step.

Autoinstallation is activated by using `dinst.auto=<url>` on kernel command line and by different file format it use
is handled differently. So lets now describe what formats are supported.

## JSON

Json format represents first use case where just data is provided. For example see **TODO link to dinstaller profile example**. It is also documented
at **TODO link to dinstaller CLI profile documentation**. It can be easily obtained by `dinstaller config show` after all configuration is done and before installation start.

## Jsonnet

Jsonnet is data templating format that represent second use case where profile is dynamically generated on target machine. For example see **TODO link to dinstaller profile example**. It is also documented
at **TODO link to dinstaller CLI profile documentation**. It is possible to generate json as shown above and replace dynamic parts as needed.

## Shell Script

Shell script basically gives user control what will be run. To configure DInstaller it uses directly DInstaller CLI, but it can call anything in insts-sys to do its job.
So e.g. if user needs at first fix degradated RAID and then re probe it by dinstaller, it is possible. Below is minimal working example to install Tumbleweed:

```sh
set -ex

/usr/bin/dinstaller config set software.product=Tumbleweed
/usr/bin/dinstaller config set user.userName=joe user.password=doe
/usr/bin/dinstaller install
```
