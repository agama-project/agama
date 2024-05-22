# Auto-installation Support for Agama

## Two different approaches

Agama offers two different approaches to unattended installation. On the one hand, the user can
provide a file, known as a "profile", that includes a description of the system to install. This
approach might sound familiar to AutoYaST users. On the other hand, Agama can accept just a plain
shell script, enabling custom pre-installation workflows.

If you are interested in using your AutoYaST profiles, Agama is not there yet. However, there are
plans to partially support them.

By now, let's have a closer look at Agama's approaches.

## Profile-based installation

**:warning: Agama is in its early stages of development, so it is not as capable as AutoYaST. As the
the project evolves, it will get new features but do not expect to support all AutoYaST options.**

A profile defines which options to use during installation: which product to install, localization
settings, partitioning schema, etc. Although it sounds similar to AutoYaST, there are some essential
differences:

* Profiles are written in [Jsonnet](https://jsonnet.org/) instead of XML. Jsonnet is a superset of
  JSON (so you can use just plain JSON), which allows for writing more readable and concise
  profiles.
* Dynamic profiles are achieved using Jsonnet itself instead of relying on *rules* or *Embedded Ruby
  (ERB)*. Agama injects hardware information that can be processed using [Jsonnet standard
  library](https://jsonnet.org/ref/stdlib.html).

### A simple example

```json
{
  "localization": {
    "language": "en_US"
  },
  "software": {
    "product": "ALP-Dolomite"
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

At this point, the profile can hold five sections: `software`, `localization`, `storage` and `user`
and `root`.

- **`software`** *(object)*: Software settings (e.g., product to install).
  - **`product`** *(string)*: Product identifier. This key is mandatory.
- **`localization`** *(object)*: Localization settings.
  - **`language`** *(string)*: System language ID (e.g., "en_US").
- **`storage`** *(object)*: Storage settings.
  - **`bootDevice`** *(string)*: Storage device used for booting (e.g., "/dev/sda"). By default, all file system are created in the boot device.
  - **`lvm`** *(boolean)*: Whether LVM is used.
  - **`encryptionPassword`** *(string)*: If set, the devices are encrypted using the given password.
- **`user`** *(object)*: First user settings.
  - **`fullName`** *(string)*: Full name (e.g., "Jane Doe").
  - **`userName`** *(string)*: User login name (e.g., "jane.doe").
  - **`password`** *(string)*: User password (e.g., "nots3cr3t").
- **`root`** *(object)*: Root authentication settings.
  - **`password`** *(string)*: Root password.
  - **`sshPublicKey`** *(string)*: SSH public key.

### Dynamic profiles

The profile can be adapted at runtime depending on the system where the auto-installation is
running. For such use cases, Agama injects the hardware information into the profile to be processed
using Jsonnet.

In the following example, the profile is adapted to install the system on the biggest disk on the
system. It also selects product based on amount of available RAM memory. The hardware information
(from `lshw`) is available as a JSON object in the `hw.libsonnet`.
There is also a set of helpers as part of hw. For documentation of those helpers see agama.libsonnet file.

```jsonnet
local agama = import 'hw.libsonnet';
local findBiggestDisk(disks) =
  local sizedDisks = std.filter(function(d) std.objectHas(d, 'size'), disks);
  local sorted = std.sort(sizedDisks, function(x) x.size);
  sorted[0].logicalname;
local memory = agama.findID(agama.lshw, 'memory').size;

{
  software: {
    product: if memory < 8000000000 then 'MicroOS' else 'Tumbleweed',
  },
  root: {
    password: 'nots3cr3t',
  },
  // there are comments!
  localization: {
    language: 'en_US',
  },
  storage: {
    bootDevice: findBiggestDisk(agama.selectClass(agama.lshw, 'disk')),
  },
}
```

**You can inspect the available
data by installing the `lshw` package and running the following command: `lshw -json`.**

### Validating and evaluating a profile

Agama includes a handy command-line interface available in the `agama-cli` package. Among many other
things, it allows for downloading, validating and evaluating profiles. For instance, we could check
the result of the previous profile by running the following command:

```
$ sudo agama profile evaluate my-profile.jsonnet
```

:exclamation: You need to use `sudo` to access the hardware information.

Do you want to check whether your profile is valid? `agama-cli` have you covered. Bear in mind that
you can only validate JSON profiles (a Jsonnet profile must be evaluated first).

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

Below there is a minimal working example to install ALP Dolomite:

```sh
set -ex

/usr/bin/agama config set software.product=ALP-Dolomite
/usr/bin/agama config set user.userName=joe user.password=doe
/usr/bin/agama install
```

You might want to have a look to [Agama's default script for inspiration](./scripts/auto.sh). Such a
script comes into action when you provide a profile.

### Support for Custom Scripts

The goal of this section is to document examples and use cases for additional scripting support in Agama auto-installation.

#### Changes Before Installation

##### Hardware Activation

In some cases it is necessary to activate tricky devices manually before starting the installation. An example is when you have two network cards, one for the external network and the other for the internal network.

```sh
set -ex

/usr/bin/agama profile download ftp://my.server/tricky_hardware_setup.sh
sh tricky_hardware_setup.sh
/usr/bin/agama config set software.product=Tumbleweed
/usr/bin/agama config set user.userName=joe user.password=doe
/usr/bin/agama install
```

##### Modifying the Installation Profile


Jsonnet may be unable to handle all of the profile changes that users wish to make.


```
set -ex

/usr/bin/agama profile download ftp://my.server/profile.json

# modify profile.json here

/usr/bin/agama profile validate profile.json
/usr/bin/agama config load profile.json

/usr/bin/agama install

```

#### After Partitioning

Note: currently not supported (params to install is not implemented yet).

##### Partitioning Changes

Sometimes there is a more complex partitioning that needs to be modified after partitioning done by Agama and before installing RPMs, such as changing the fstab and mount an extra partition.


```sh
set -ex

/usr/bin/agama config set software.product=Tumbleweed
/usr/bin/agama config set user.userName=joe user.password=doe

/usr/bin/agama install --until partitioning # install till the partitioning step

# Place for specific changes to /dev

/usr/bin/agama install # do the rest of the installation
```

#### After Deployment

Note: not supported now (params to install is not implemented yet).

##### Setup Security


If there is a need to modify the system before rebooting, e.g. to install mandatory security software for internal network, then it must be modified before umount.


``` sh

set -ex

/usr/bin/agama profile download ftp://my.server/velociraptor.config

/usr/bin/agama config set software.product=Tumbleweed
/usr/bin/agama config set user.userName=joe user.password=doe

/usr/bin/agama install --until deploy # do partitioning, rpm installation and configuration step

# Example of enabling velociraptor

zypper --root /mnt install velociraptor-client

mkdir -p /mnt/etc/velociraptor
cp velociraptor.config /mnt/etc/velociraptor/client.config

systemctl --root /mnt enable velociraptor-client

/usr/bin/agama install # do the rest of the installation - basically unmount and copy logs

```

##### Tuning the Kernel

Another scenario is when you need to make some changes required for a successful reboot, such as some kernel tuning or adding some remote storage that needs to be mounted during boot.

``` sh
set -ex

/usr/bin/agama config set software.product=Tumbleweed
/usr/bin/agama config set user.userName=joe user.password=doe

/usr/bin/agama install --until deploy # do partitioning, rpm installation and configuration step

# Do custom modification of /mnt including call to dracut

/usr/bin/agama install # do the rest of the installation - basically unmount and copy logs
```

#### After Reboot

Users usually do a lot of things with post installation scripts in AutoYaST e.g. calling zypper to install additional software, modify configuration files or manipulate with systemd services. This is done after the first reboot.
If this is the case, Agama will simply delegate it to any other tool the user prefers for initial configuration, such as ignition/combustion.

## Starting the auto-installation

The auto-installation is started by passing `agama.auto=<url>` on the kernel's command line. If you
are using the Live media, you need to edit the Grub2 entry to add that option. Or you can use PXE
if it fits better. For instance, `agama.auto=http://example.net/bedrock.jsonnet`.

Using the correct extension in the file name is important:

* `.jsonnet` enables dynamic content through Jsonnet.
* `.json` assumes the profile is just a JSON file, so no dynamic content is expected.
* `.sh` would be interpreted as a shell script.

## Caveats

Auto-installation support is far from being complete, so you should have a few things into account:

* Progress reporting through the command-line interface is limited, so you should watch the web
  interface, especially if the installation gets stuck.
* If something goes wrong processing the profile, you will not notice because Agama does not report
  such problems yet. The only consequence is that the installation will not start. You can check the
  output of `journalctl -u agama-auto` for further information.
* You need to manually reboot the system after installation.
