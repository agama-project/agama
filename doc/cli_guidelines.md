# Agama CLI Guidelines

This document defines the syntax for the Agama CLI. For more CLI specific aspects like return values, flags, etc, please refer to [clig.dev](https://clig.dev/). Guidelines from clig.dev are agnostic about programming languages and tooling in general, and it can be perfectly used as reference for the Agama CLI.

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

In the following commands `<key>` represents a YAML key from the config structure and `<value>` is the value associated to the given key. Nested keys are dot-separated (e.g., `user.name`).

This is the list of all sub-commands and verbs:

~~~
$ agama install
Starts the installation.

$ agama abort
Aborts the installation.

$ agama status
Prints the current status of the installation process and informs about pending actions (e.g., if there are questions waiting to be answered, if a product is not selected yet, etc).

$ agama watch
Prints messages from the installation process (e.g., progress, questions, etc).

$ agama config load <file>
Loads installation config from a YAML file, keeping the rest of the config as it is.

$ agama config show [<key>]
Prints the current installation config in YAML format. If a <key> is given, then it only prints the content for the given key.

$ agama config set <key>=<value> ...
Sets a config value for the given key.

$ agama config unset <key>
Removes the current value for the given key.

$ agama config reset [<key>]
Sets the default value for the given <key>. If no key is given, then the whole config is reset.

$ agama config add <list-key> [<key>=]<value> ...
Adds a new entry with all the given key-value pairs to a config list. The `<key>=` part is omitted for a list of scalar values (e.g., languages).

$ agama config delete <list-key> [<key>=]<value> ...
Deletes any entry matching all the given key-value pairs from a config list. The `<key>=` part is omitted for a list of scalar values.

$ agama config check
Validates the config and prints errors

$ agama config info <key> [<value>]
Prints info about the given key. If no value is given, then it prints what values are admitted by the given key. If a value is given, then it shows extra info about such a value.

$ agama summary [<section>]
Prints a summary with the actions to perform in the system. If a section is given (e.g., storage, software, ...), then it only shows the section summary.

$ agama questions
Prints questions and allows to answer them.

~~~

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
  password: "12345"
  autologin: true

root:
  ssh_key: "1234abcd"
  password: "12345"

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

### Examples

Let's see some examples:

~~~
# Set a product
$ agama config set product=Tumbleweed

# Set user values
$ agama config set user.name=linux
$ agama config set user.fullname=linux
$ agama config set user.password=linux
$ agama config set user.name=linux user.fullname=linux user.password=12345

# Unset user
$ agama config unset user

# Add and delete languages
$ agama config add languages en_US
$ agama config delete languages en_US

# Set storage settings
$ agama config set storage.lvm=false
$ agama config set storage.encryption_password=12345

# Add and delete candidate devices
$ agama config add storage.candidate_devices /dev/sda
$ agama config delete storage.candidate_devices /dev/sdb

# Add and delete storage volumes
$ agama config add storage.volumes mountpoint=/ minsize=10GiB
$ agama config delete storage.volumes mountpoint=/home

# Reset storage config
$ agama config reset storage

# Show some config values
$ agama config show storage.candidate_devices
$ agama config show user

# Dump config into a file
$ agama config show > ~/config.yaml

# Show info of a key
$ agama config info storage.candidate_devices
$ agama config info languages

# Show info of a specific value
$ agama config info storage.candidate_devices /dev/sda

# Show the storage actions to perform in the system
$ agama summary storage
~~~

## Product Selection

Agama can automatically infers all the config values, but at least one product must be selected. Selecting a product implies some actions in the D-Bus services (e.g., storage devices are probed). And the D-Bus services might emit some questions if needed (e.g., asking to provide a LUKS password). Because of that, the command for selecting a product could ask questions to the user:

~~~
$ agama config set product=ALP
> The device /dev/sda is encrypted. Provide an encryption password if you want to open it (enter to skip):
~~~

If a product is not selected yet, then many commands cannot work. In that case, commands should inform about it:

~~~
$ agama config show
A product is not selected yet. Please, select a product first: agama config set product=<product>.
~~~

## D-Bus Questions

Sometimes answering pending questions is required before performing the requested command. For example, for single product live images the storage proposal is automatically done (the target product is already known). If some questions were emitted during the process, then they have to be answered before continuing using the CLI. Commands would show a warning to inform about the situation and how to proceed:

~~~
$ agama config show
There are pending questions. Please, answer questions first: agama questions.
~~~

## Non Interactive Mode

Commands should offer a `--non-interactive` option to make scripting possible. The non interactive mode should allow answering questions automatically.

TBD: Non interactive mode will be defined later in the next iteration.
