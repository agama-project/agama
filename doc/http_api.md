# HTTP API

This document outlines the HTTP API of Agama. It provides an alternative way to interact with the system, complementing the Command Line Interface (CLI) and web user interface. It's important to note that both the CLI and web UI also leverage this HTTP API for their operations.

**Note**: Agama uses *OpenAPI* to document its HTTP API. You can generate the documentation using the following commands:

```shell
(cd rust; cargo xtask openapi)
cat rust/out/openapi/*.json
```

## Overview

The API is designed around 3 main concepts: *system*, *config* and *proposal*.

* *system*: represents the current status of the running system.
* *config*: represents the configuration for installing the target system.
* *proposal*: represents what is going to be done in the target system.

The *config* contains elements that can modify the *system*, the *proposal* or both. For example, the *dasd* config changes the *system*, and the *storage* config changes the *proposal*. In other cases like *network*, the config can affect to both *system* and *proposal*.

~~~
GET             /status
GET             /system
GET             /extended_config
GET PUT PATCH   /config
GET POST PATCH  /questions
GET             /proposal
GET             /issues
POST            /action
~~~

### GET /status

Reports the status of the installation. It contains the installation state (*configuring*, *installing*, *finished*) and the active progresses.

### GET /system

Returns a JSON with the info of the system (storage devices, network connections, current localization, etc).

### GET /extended_config

Returns the *extended config* JSON.

There is a distinction between *extended config* and *config*:

* The *config* is the config explicitly set by the clients.
* The *extended config* is the config used for calculating the proposal and it is built by merging the the *config* with the default *extended config*. The default *extended config* is built from the *system info* and the *product info*.

For example, if only the *locale* was configured by the user, then the *config*  has no *keymap* property. Nevertheless, the *extended config* would have a *keymap* with the value from the default *extended config*.

### GET PUT /config

Reads or replaces the *config*. In case of patching, the given config is merged into the current *extended config*.

### PATCH /config

Applies changes in the *config*. There is an own patch document:

~~~json
{
  "update": {
    "l10n": {
      "keymap": "es"
    }
  }
}
~~~

The given config from the *update* key is merged into current *extended config*.

The patch document could be extended in the future with more options, for example for resetting some parts of the config.

See https://datatracker.ietf.org/doc/html/rfc5789#section-2

### POST /action

Allows performing actions that cannot be done as side effect of applying a config. For example, start the installation, reload the system, etc. The *actions schema* defines the possible actions, parameters, etc.

#### Example: reload the system

In some cases, clients need to request a system reload. For example, if you create a RAID device using the terminal, then you need to reload the system in order to see the new device. In the future, reloading the system could be automatically done (e.g., by listening udisk D-Bus). For now, reloading has to be manually requested.

~~~
POST /action { "reloadSystem": "storage" }
~~~

#### Example: change the system localization

Sometimes we need to directly modify the system without changing the config. For example, switching the locale of the running system (UI language).

~~~
POST /action { "configureL10n": { language: "es_ES" } }
~~~

#### Example: start installation

The installation can be started by calling the proper action.

~~~
POST /action "install"
~~~
