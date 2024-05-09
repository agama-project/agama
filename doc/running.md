# Running from sources

You can run Agama from its sources by cloning and configuring the project:

```console
$ git clone https://github.com/openSUSE/agama
$ cd agama
$ ./setup.sh
```

Then point your browser to http://localhost:8080/, login with your
root password and that's all.

The [setup.sh](./setup.sh) script installs the required dependencies to build and run the project
and it also configures the Agama services. It uses `sudo` to install packages and files to system
locations. The script is well commented so we refer you to it instead of repeating its steps here.

Regarding the web user interface, alternatively you can run a development
server which works as a proxy for Agama's server. See more details [in the
documentation]( web/README.md#using-a-development-server).

To start or stop Agama D-Bus and web services at any time, use the `agama` and `agama-web-server` systemd services:

```console
sudo systemctl start agama
sudo systemctl start agama-web-server
```

If something goes wrong, you can use `journalctl` to get Agama logs:

```console
sudo journalctl -u agama
sudo journalctl -u agama-web-server
```

Another alternative is to run source checkout inside container so system is not
affected by doing testing run beside real actions really done by installer.
See more details [in the documentation](doc/testing_using_container.md).
