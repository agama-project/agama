# Agama Server

According to [Agama's architecture](../doc/architecture.md) this project implements the following components:

* The *Agama server*, excluding *Agama YaST* which lives in the [service](../service) directory.
* The *Agama D-Bus service*.
* The *Command Line Interface*.

## Code organization

We have set up [Cargo workspace](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html) with
three packages:

* [agama-lib](./agama-lib): code that can be reused to access the
  [Agama D-Bus API](https://github.com/yast/agama/blob/master/doc/dbus_api.md) and a
  model for the configuration settings.
* [agama-cli](./agama-cli): code specific to the command-line interface.
* [agama-settings](./agama-settingS) and [agama-derive](./agama-derive): includes a [procedural
  macro](https://doc.rust-lang.org/reference/procedural-macros.html) to reduce the boilerplate code.
* [agama-locale-data](./agama-locale-data): specific library to provide data for localization D-Bus
  API
* [agama-server](./agama-server): implements the HTTP/JSON (and WebSocket) API. Additionally, it
  offers a minimal D-Bus API for internal communication.

## Other resources

* [Web server development notes](/rust/WEB-SERVER.md).
