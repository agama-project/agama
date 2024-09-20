---
sidebar_position: 8
---

# Testing using a container

To test complex change that affects multiple parts of Agama it is possible to run from sources using
container that is used to run CI.

Use the
[testing_using_container.sh](https://github.com/openSUSE/agama/blob/master/testing_using_container.sh)
shell script. That scripts does several steps:

- Starts the container
- Installs the needed packages, compiles the sources and starts the servers (using the
  [setup.sh](https://github.com/openSUSE/agama/blob/master/setup.sh) script)
- It asks for the new root password to allow logging in (by default there is no root password set in
  containers)
- It provides web UI on a forwarded HTTPS port, [https://localhost:10443/]
- Starts a shell inside the container with root access for more testing or debugging.
