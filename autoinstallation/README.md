# Auto-installation Support for Agama

## Two different approaches

Agama offers two different approaches to unattended installation. On the one hand, the user can
provide a file, known as a "profile", that includes a description of the system to install. This
approach might sound familiar to AutoYaST users. On the other hand, Agama can accept just a plain
shell script, enabling custom pre-installation workflows.

Although Agama defines its own [profile format](../rust/agama-lib/share/profile.schema.json), it is
able to partially handle AutoYaST profiles. Please, check the [AutoYaST support document](../doc/
autoyast.md) for further information.

## Profile-based installation

A profile defines which options to use during installation: which product to install, localization
settings, partitioning schema, etc. Although it sounds similar to AutoYaST, there are some essential
differences:

- Profiles are written in [Jsonnet](https://jsonnet.org/) instead of XML. Jsonnet is a superset of
  JSON (so you can use just plain JSON), which allows for writing more readable and concise
  profiles.
- Dynamic profiles are achieved using Jsonnet itself instead of relying on _rules_ or _Embedded Ruby
  (ERB)_. Agama injects hardware information that can be processed using
  [Jsonnet standard library](https://jsonnet.org/ref/stdlib.html).

You can check the
[Tumbleweed installation profile](../rust/agama-lib/share/examples/profile_tw.json) included in the
repository to get an impression of how a profile looks like.

### A simple example

```json
{
  "l10n": {
    "languages": ["en_US.UTF-8"]
  },
  "product": {
    "id": "Tumbleweed"
  },
  "storage": {
    "bootDevice": "/dev/sda"
  },
  "user": {
    "fullName": "Jane Doe",
    "password": "123456",
    "userName": "jane.doe"
  }
}
```

### Supported configuration values

Check the [JSON Schema](../rust/agama-lib/share/profile.schema.json) to learn about the supported
elements.

### Dynamic profiles

The profile can be adapted at runtime depending on the system where the auto-installation is
running. For such use cases, Agama injects the hardware information into the profile to be processed
using Jsonnet.

Please, check [the example profile](../rust/agama-lib/share/examples/profile.jsonnet) for further
information.

> [!NOTE]
> You can inspect the available data by installing the `lshw` package and running the following
> command: `lshw -json`.

### Validating and evaluating a profile

Agama includes a handy command-line interface available in the `agama` package. Among many other
things, it allows downloading, validating and evaluating profiles. For instance, we could check the
result of the previous profile by running the following command:

```
$ sudo agama profile evaluate my-profile.jsonnet
```

> [!WARNING]
 You need to use `sudo` to access the hardware information.

Do you want to check whether your profile is valid? `agama` have you covered. Bear in mind that you
can only validate JSON profiles (a Jsonnet profile must be evaluated first).

```
$ agama profile validate my-profile.json
```

### Generating a configuration file

Writing the profile by hand is relatively easy. However, you might want to ask Agama to do it for
you. You can boot the installation, use the web interface to tweak all the values and, from the
terminal, generate the file by running the following command:

```
$ sudo agama config show > profile.json
```

## Shell-based installation

Instead of a profile, you can provide a shell script, having complete control of the process. In
this scenario, it is expected to use the CLI to interact with Agama. In addition, you can rely on
any other tool available in the installation media. What's more, when using the Live ISO, you could
install your own tools.

Below there is a minimal working example to install Tumbleweed:

```sh
set -ex

/usr/bin/agama profile import ftp://my.server/profile.json
/usr/bin/agama install
```

You might want to have a look to [Agama's default script for inspiration](./scripts/auto.sh). Such a
script comes into action when you provide a profile.

### Support for Custom Scripts

The goal of this section is to document examples and use cases for additional scripting support in
Agama auto-installation.

#### Changes Before Installation

##### Hardware Activation

In some cases it is necessary to activate tricky devices manually before starting the installation.
An example is when you have two network cards, one for the external network and the other for the
internal network.

```sh
set -ex

/usr/bin/agama download ftp://my.server/tricky_hardware_setup.sh > tricky_hardware_setup.sh
sh tricky_hardware_setup.sh
/usr/bin/agama profile import ftp://my.server/profile.json
/usr/bin/agama install
```

##### Modifying the Installation Profile

Jsonnet may be unable to handle all of the profile changes that users wish to make.

```
set -ex

/usr/bin/agama download ftp://my.server/profile.json > /root/profile.json

# modify profile.json here

/usr/bin/agama profile import file:///root/profile.json
/usr/bin/agama install
```

#### After Partitioning

Note: currently not supported (params to install is not implemented yet).

##### Partitioning Changes

Sometimes there is a more complex partitioning that needs to be modified after partitioning done by
Agama and before installing RPMs, such as changing the fstab and mount an extra partition.

```sh
set -ex

/usr/bin/agama profile import http://my.server/profile.json
/usr/bin/agama install --until partitioning # install till the partitioning step

# Place for specific changes to /dev

/usr/bin/agama install # do the rest of the installation
```

#### After Deployment

Note: not supported now (params to install is not implemented yet).

##### Setup Security

If there is a need to modify the system before rebooting, e.g. to install mandatory security
software for internal network, then it must be modified before umount.

```sh
set -ex

/usr/bin/agama download ftp://my.server/velociraptor.config
/usr/bin/agama profile import http://my.server/profile.json
/usr/bin/agama install --until deploy # do partitioning, rpm installation and configuration step

# Example of enabling velociraptor

zypper --root /mnt install velociraptor-client

mkdir -p /mnt/etc/velociraptor
cp velociraptor.config /mnt/etc/velociraptor/client.config

systemctl --root /mnt enable velociraptor-client

/usr/bin/agama install # do the rest of the installation - basically unmount and copy logs
```

##### Tuning the Kernel

Another scenario is when you need to make some changes required for a successful reboot, such as
some kernel tuning or adding some remote storage that needs to be mounted during boot.

```sh
set -ex

/usr/bin/agama profile import http://my.server/profile.json
/usr/bin/agama install --until deploy # do partitioning, rpm installation and configuration step

# Do custom modification of /mnt including call to dracut

/usr/bin/agama install # do the rest of the installation - basically unmount and copy logs
```

#### After Reboot

Users usually do a lot of things with post installation scripts in AutoYaST e.g. calling zypper to
install additional software, modify configuration files or manipulate with systemd services. This is
done after the first reboot. If this is the case, Agama will simply delegate it to any other tool
the user prefers for initial configuration, such as ignition/combustion.

## Starting the auto-installation

The auto-installation is started by passing `agama.auto=<url>` on the kernel's command line. If you
are using the Live media, you need to edit the Grub2 entry to add that option. Or you can use PXE if
it fits better. For instance, `agama.auto=http://example.net/bedrock.jsonnet`.

Using the correct extension in the file name is important:

- `.jsonnet` enables dynamic content through Jsonnet.
- `.json` assumes the profile is just a JSON file, so no dynamic content is expected.
- `.xml`, `.erb` or a trailing slash (`/`) indicates that you want to import an AutoYaST profile.
  Check [autoyast.md](../doc/autoyast.doc) for further information.
- `.sh` would be interpreted as a shell script.

## Caveats

Auto-installation support is far from being complete, so you should have a few things into account:

- Progress reporting through the command-line interface is limited, so you should watch the web
  interface, especially if the installation gets stuck.
- If something goes wrong processing the profile, you will not notice because Agama does not report
  such problems yet. The only consequence is that the installation will not start. You can check the
  output of `journalctl -u agama-auto` for further information.
- You need to manually reboot the system after installation.
