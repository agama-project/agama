---
sidebar_position: -1
---

# Running from sources

You can run Agama from its sources by cloning and configuring the project:

```console
git clone https://github.com/openSUSE/agama
cd agama
./setup.sh
```

Then point your browser to `http://localhost:8080/`, log in with your root password and that's all.

The [setup.sh](https://github.com/openSUSE/agama/blob/master/setup.sh) script installs the required
dependencies to build and run the project and it also configures the Agama services. It uses `sudo`
to install packages and files to system locations. The script is well commented so we refer you to
it instead of repeating its steps here.

To start or stop Agama D-Bus and web services at any time, use the `agama` and `agama-web-server`
systemd services:

```console
sudo systemctl start agama
sudo systemctl start agama-web-server
```

If something goes wrong, you can use `journalctl` to get Agama logs:

```console
sudo journalctl -u agama
sudo journalctl -u agama-web-server
```

Another alternative is to run source checkout inside container so system is not affected by doing
testing run beside real actions really done by installer. See more details [in the
documentation](./testing_using_container.md).

:::warning
To do: integrate the information about running the proxy web server (`AGAMA_SERVER` argument).
:::
