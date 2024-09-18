---
sidebar_position: 2
---

# Unattended installation

One of the main use cases of Agama is unatteded installation. The user provides a file, known as a
"profile", that describes how the system should look like (partitioning, networking, software
selection, etc.) and Agama takes care of installing the system according to such a description. This
approach might sound familiar to AutoYaST users.

Although Agama defines its own [profile format](../rust/agama-lib/share/profile.schema.json), it is
able to partially handle AutoYaST profiles. Please, check the [AutoYaST support
section](autoyast.md) for further information.

## Profile format

A profile defines which options to use during installation: which product to install, localization
settings, partitioning schema, etc. Although it sounds similar to AutoYaST, there are some essential
differences:

- Profiles are written in [Jsonnet](https://jsonnet.org/) instead of XML. Jsonnet is a superset of
  JSON (so you can use just plain JSON), which allows for writing more readable and concise
  profiles.
- You can take advantage of Jsonnet to build dynamic profiles, without having to rely on _rules_ or
  _Embedded Ruby (ERB)_. Agama injects hardware information that can be processed using the [Jsonnet
  standard library](https://jsonnet.org/ref/stdlib.html).

You can check the [Tumbleweed installation
profile](https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile_tw.json)
included in the repository to get an impression of how a profile looks like.

### A minimal example

```json
{
  "l10n": {
    "languages": ["en_US.UTF-8"]
  },
  "product": {
    "id": "Tumbleweed"
  },
  "user": {
    "fullName": "Jane Doe",
    "userName": "jane.doe",
    "password": "123456"
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

Please, check [the example
profile](https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile.jsonnet)
for further information.

:::tip Getting hardware information
You can inspect the available data by installing the `lshw` package and running the following
command: `lshw -json`.
:::

### Validating and evaluating a profile

Agama includes a handy command-line interface available in the `agama` package. Among many other
things, it allows downloading, validating and evaluating profiles. For instance, we could check the
result of the previous profile by running the following command:

```console
sudo agama profile evaluate my-profile.jsonnet
```

:::warning Use `sudo`
You need to use `sudo` to access the hardware information.
:::

Do you want to check whether your profile is valid? `agama` have you covered. Bear in mind that you
can only validate JSON profiles (a Jsonnet profile must be evaluated first).

```console
agama profile validate my-profile.json
```

### Generating a configuration file

Writing the profile by hand is relatively easy. However, you might want to ask Agama to do it for
you. You can boot the installation, use the web interface to tweak all the values and, from the
terminal, generate the file by running the following command:

```console
sudo agama config show > profile.json
```

## Starting the installation

To start an unattended installation process, you need to tell Agama where to find the profile. When
using the Live ISO, you must use the `agama.auto` boot option. Please, check the [boot
options](boot_options.md) for further information.
