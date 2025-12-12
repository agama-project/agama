# Testing scripts

This directory contains some scripts that you can use to test the API. For them to work, you need to
specify the URL of your Agama server (it might be running, for instance, on a virtual machine):

```
export AGAMA_URL=https://192.168.122.10
```

## Logging in

Before running any other script, you need to log into the API. You can use the `login.sh` script for
that. It will generate a `headers.txt` file that contains the authentication token. By default, it
uses the password `linux`, which is hardcoded into the script.

```
$ ./login.sh
Logging in https://192.168.122.10
Using token eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NjU2MzA2MjYsImNsaWVudF9pZCI6IjczNTJmYzFjLWVlNGItNDUzMC05NzY2LTFiMGEyODk3ZDlkZCJ9.fjkk4mab0mTEc-e3IevhKJu2pOkz6Ie0kVQD9GXZ_ZQ

```

## Setting the configuration

The `set-config.sh` script allows to partially update the configuration. It receives a JSON file
containing the body of the PATCH request. Check `examples/*.patch.json` for some examples.

```
$ ./set-config.sh examples/tumbleweed.patch.json
```

You can check the user configuration using the `get-config.sh` script.

## Getting the status

There are a few scripts to retrieve different aspects of the system (status, system information,
configuration, etc.). Check for `get-*.sh` scripts.

## Listening to events

You can listen to Agama events using the `monitor-*.sh` scripts:

- `monitor-websocat.sh`: it relies on [websocat](https://github.com/vi/websocat). Unfortunately, the
  program is not available in the official openSUSE repositories, so you might need to use
  `cargo install` (or `cargo binstall`).
- `monitor-curl.sh`: it uses `curl` under the hood. The output is less convenient, but you do not
  need an extra tool (TODO: improve the `curl` invocation).
