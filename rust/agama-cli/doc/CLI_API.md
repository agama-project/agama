# Agama CLI

Agama already shipped an initial CLI prototype for managing and driving the installation process. Note that such a CLI was created as a proof of concept, and its current API needs some refactoring. This document is intended to discuss how the new CLI should look like, what patterns to follow, etc.

## CLI Guidelines

There already are guidelines for creating modern CLI applications. For example [clig.dev](https://clig.dev/) defines a guide that is agnostic about programming languages and tooling in general, and it can be perfectly used as reference for Agama CLI.

## Command name

Some naming recommendations from the guidelines:

* Make it a simple, memorable word
* Use only lowercase letters, and dashes if you really need to
* Keep it short
* Make it easy to type

Currently we have two executable scripts: `d-installer` for managing the D-Bus services and `dinstallerctl` for configuring and performing the installation. We would need to re-consider which one should have the `ctl` suffix. Moreover, dashes are not recommended (`dinstaller` vs `d-installer`).

## Subcommands

Let's list the recommendations from the guidelines:

* Be consistent across subcommands. Use the same flag names for the same things, have similar output formatting, etc.
* Use consistent names for multiple levels of subcommand. If a complex piece of software has lots of objects and operations that can be performed on those objects, it is a common pattern to use two levels of subcommand for this, where one is a noun and one is a verb. For example, `docker container create`. Be consistent with the verbs you use across different types of objects.
* Don’t have ambiguous or similarly-named commands. For example, having two subcommands called “update” and “upgrade” is quite confusing.

## New CLI

The API of the current CLI is not consistent. It sometimes uses verbs for the subcommand action (e.g., `agama user clear`), and for other subcommands adjectives or noums are used (e.g., `agama language selected <id>`). Moreover, there is a subcommand per each area, for example `agama language`, `agama software`, `agama storage`, etc. Having a subcommand for each area is not bad per se, but for some areas like storage the subcommand could grow with too many actions and options.

The new CLI could be designed with more generic subcommands and verbs, allowing to configure any installation setting in a standart way. Note that the installation process can be already configured by means of a YAML config file with `agama config load <file>`. And the options currently supported by the config file are:

~~~
---
product: "Tumbleweed"

languages:
  - "es_ES"
  - "en_US"

disks:
  - /dev/vda
  - /dev/vdb

user:
  name: "test"
  fullname: "User Test"
  password: "12345"
  autologin: true

root:
  ssh_key: "1234abcd"
  password: "12345"
~~~

We could extend the `config` subcommand for editing such a config without the need of a subcommand per area. In general, the `config` subcommand should have verbs for the following actions:

* To load a YAML config file with the values for the installation.
* To edit any value of the config without loading a new complete file again.
* To show the current config for the installation.
* To validate the current config.

Moreover, the CLI should also offer subcommands for these actions:

* To ask for the possible values that can be used for some setting (e.g., list of available products).
* To start and abort the installation.
* To see the installation status.

Let's assume we will use `agamactl` for managing D-Bus services and `agama` for driving the installation (the opposite as it is now). The CLI for Agama could look like something similar to this:

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
Adds a new entry with all the given key-value pairs to a config list. The key is omitted for a list of scalar values (e.g., languages).

$ agama config delete <list-key> [<key>=]<value> ...
Deletes any entry matching all the given key-value pairs from a config list. The key is omitted for a list of scalar values.

$ agama config check
Validates the config and prints errors

$ agama info <key> [<value>]
Prints info about the given key. If no value is given, then it prints what values are admitted by the given key. If a value is given, then it shows extra info about such a value.

$ agama summary [<section>]
Prints a summary with the actions to perform in the system. If a section is given (e.g., storage, software, ...), then it only shows the section summary.

$ agama questions
Prints questions and allows to answer them.

~~~

In those commands `<key>` represents a YAML key from the config file (e.g., `root.ssh_key`) and `<value>` is the value associated to the given key. Note that dots are used for nested keys. Let's see some examples:

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
$ agama info storage.candidate_devices
$ agama info storage.candidate_devices /dev/sda
$ agama info languages
~~~

### Config file

The current YAML config file needs to be extended in order to support the new storage proposal settings offered by the D-Bus API:

~~~
...

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

### Product Selection

Agama can automatically infers all the config values, but at least one product must be selected. Selecting a product implies some actions in the D-Bus services (e.g., storage devices are probed). And the D-Bus services might emit some questions if needed (e.g., asking to provide a LUKS password). Because of that, the command for selecting a product could ask questions to the user:

~~~
$ agama config set product=ALP
> The device /dev/sda is encrypted. Provide an encryption password if you want to open it (enter to skip):
~~~

Another option would be to avoid asking questions directly, and to request the answer when another command is used (see *D-Bus Questions* section).

If a product is not selected yet, then many commands cannot work. In that case, commands should inform about it:

~~~
$ agama config show
A product is not selected yet. Please, select a product first: agama config set product=<product>.
~~~

### D-Bus Questions

The CLI should offer a way of answering pending questions. For example, for single product live images the storage proposal is automatically done because the target product is already known. If some questions were emitted during the process, then they have to be answered before continuing using the CLI. Therefore, most of the commands would show a warning to inform about the situation and how to proceed:

~~~
$ agama config show
There are pending questions. Please, answer questions first: agama questions.
~~~

### Non Interactive Mode

Commands should offer a `--non-interactive` option to make scripting possible. The non interactive mode should offer a way to answer questions automatically. Non interactive mode will be defined later in a following interation of the CLI definition.

## Current CLI

As reference, this is the current CLI:

~~~
dinstallerctl install # Perform the installation

dinstallerctl config dump            # Dump the current installation config to stdout
dinstallerctl config load <config>   # Load a config file and apply the configuration

dinstallerctl language available           # List available languages for the installation
dinstallerctl language selected [<id>...]  # Select the languages to install in the target system

dinstallerctl rootuser clear                        # Clear root configuration
dinstallerctl rootuser password [<plain password>]  # Set the root password
dinstallerctl rootuser ssh_key [<key>]              # Set the SSH key for root

dinstallerctl software available_products       # List available products for the installation
dinstallerctl software selected_product [<id>]  # Select the product to install in the target system

dinstallerctl storage actions                         # List the storage actions to perform
dinstallerctl storage available_devices               # List available devices for the installation
dinstallerctl storage selected_devices [<device>...]  # Select devices for the installation

dinstallerctl user clear           # Clear the user configuration
dinstallerctl user set <name>      # Configure the user that will be created during the installation
dinstallerctl user show            # Show the user configuration`
~~~


Original post with discussion is at https://gist.github.com/joseivanlopez/808c2be0cf668b4b457fc5d9ec20dc73
