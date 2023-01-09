# D-Installer CLI Guidelines

This document defines the syntax for the D-Installer CLI. For more CLI specific aspects like return values, flags, etc, please refer to [clig.dev](https://clig.dev/). Guidelines from clig.dev are agnostic about programming languages and tooling in general, and it can be perfectly used as reference for the D-Installer CLI.

## CLI Syntax

Note: The syntax presented here was previously discussed in this [document](https://gist.github.com/joseivanlopez/808c2be0cf668b4b457fc5d9ec20dc73).

The installation settings are represented by a YAML structure, and the CLI is defined as a set of generic sub-commands and verbs that allow to edit any YAML value in a standard way.

The CLI offers a `config` sub-command for editing the YAML config. The `config` sub-command has verbs for the following actions:

* To load a YAML config file with the values for the installation.
* To edit any value of the config without loading a new complete file again.
* To show the current config for the installation.
* To check the current config.

Moreover, the CLI also offers sub-commands for these actions:

* To ask for the possible values that can be used for some setting (e.g., list of available products).
* To start and abort the installation.
* To see the installation status.
* To answers questions.

### Sub-commands and Verbs

This is the list of all sub-commands and verbs:

~~~
$ dinstaller install
Starts the installation.

$ dinstaller abort
Aborts the installation.

$ dinstaller status
Prints the current status of the installation process and informs about pending actions (e.g., if there are questions waiting to be answered, if a product is not selected yet, etc).

$ dinstaller watch
Prints messages from the installation process (e.g., progress, questions, etc).

$ dinstaller config load <file>
Loads installation config from a YAML file, keeping the rest of the config as it is.

$ dinstaller config show [<key>]
Prints the current installation config in YAML format. If a <key> is given, then it only prints the content for the given key.

$ dinstaller config set <key>=<value> ...
Sets a config value for the given key.

$ dinstaller config unset <key>
Removes the current value for the given key.

$ dinstaller config reset [<key>]
Sets the default value for the given <key>. If no key is given, then the whole config is reset.

$ dinstaller config add <list-key> [<key>=]<value> ...
Adds a new entry with all the given key-value pairs to a config list. The key is omitted for a list of scalar values (e.g., languages).

$ dinstaller config delete <list-key> [<key>=]<value> ...
Deletes any entry matching all the given key-value pairs from a config list. The key is omitted for a list of scalar values.

$ dinstaller config check
Validates the config and prints errors

$ dinstaller config info <key> [<value>]
Prints info about the given key. If no value is given, then it prints what values are admitted by the given key. If a value is given, then it shows extra info about such a value.

$ dinstaller summary [<section>]
Prints a summary with the actions to perform in the system. If a section is given (e.g., storage, software, ...), then it only shows the section summary.

$ dinstaller questions
Prints questions and allows to answer them.

~~~

In those commands `<key>` represents a YAML key from the config structure and `<value>` is the value associated to the given key.

### YAML Config

The config settings are defined by this YAML structure:

~~~
---
product: "Tumbleweed"

languages:
  - "es_ES"
  - "en_US"

user:
  name: "test"
  fullname: "User Test"
  password: "n0ts3cr3t"
  autologin: true

root:
  ssh_key: "1234abcd"
  password: "n0ts3cr3t"

storage:
  candidate_devices:
    - /dev/sda
  lvm: true
  encryption_password: 12345
  volumes:
    - mountpoint: /
      fstype: btrfs
    - mountpoint: /home
      fstype: ext4
      minsize: 10GiB
~~~

Nested keys are referenced in commands by joining them with dots (e.g., `user.name`).

### Examples

Let's see some examples:

~~~
# Set a product
$ dinstaller config set product=Tumbleweed

# Set user values
$ dinstaller config set user.name=linux
$ dinstaller config set user.fullname=linux
$ dinstaller config set user.password=linux
$ dinstaller config set user.name=linux user.fullname=linux user.password=12345

# Unset user
$ dinstaller config unset user

# Add and delete languages
$ dinstaller config add languages en_US
$ dinstaller config delete languages en_US

# Set storage settings
$ dinstaller config set storage.lvm=false
$ dinstaller config set storage.encryption_password=12345

# Add and delete candidate devices
$ dinstaller config add storage.candidate_devices /dev/sda
$ dinstaller config delete storage.candidate_devices /dev/sdb

# Add and delete storage volumes
$ dinstaller config add storage.volumes mountpoint=/ minsize=10GiB
$ dinstaller config delete storage.volumes mountpoint=/home

# Reset storage config
$ dinstaller config reset storage

# Show some config values
$ dinstaller config show storage.candidate_devices
$ dinstaller config show user

# Dump config into a file
$ dinstaller config show > ~/config.yaml

# Show info of a key
$ dinstaller config info storage.candidate_devices
$ dinstaller config info languages

# Show info of a specific value
$ dinstaller config info storage.candidate_devices /dev/sda
~~~

## Product Selection

D-Installer can automatically infers all the config values, but at least one product must be selected. Selecting a product implies some actions in the D-Bus services (e.g., storage devices are probed). And the D-Bus services might emit some questions if needed (e.g., asking to provide a LUKS password). Because of that, the command for selecting a product could ask questions to the user:

~~~
$ dinstaller config set product=ALP
> The device /dev/sda is encrypted. Provide an encryption password if you want to open it (enter to skip):
~~~

If a product is not selected yet, then many commands cannot work. In that case, commands should inform about it:

~~~
$ dinstaller config show
A product is not selected yet. Please, select a product first: dinstaller config set product=<product>.
~~~

## D-Bus Questions

Sometimes answering pending questions is required before performing the requested command. For example, for single product live images the storage proposal is automatically done (the target product is already known). If some questions were emitted during the process, then they have to be answered before continuing using the CLI. Commands would show a warning to inform about the situation and how to proceed:

~~~
$ dinstaller config show
There are pending questions. Please, answer questions first: dinstaller questions.
~~~

## Non Interactive Mode

Commands should offer a `--non-interactive` option to make scripting possible. The non interactive mode should allow answering questions automatically.

TBD: Non interactive mode will be defined later in the next iteration.
