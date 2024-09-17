---
sidebar_position: 8
---

# Testing Using Container

To test complex change that affects multiple parts of Agama it is possible to
run from sources using container that is used to run CI.

Use the [testing_using_container.sh](../testing_using_container.sh) shell
script. That scripts does several steps:

- Starts the container
- Installs the needed packages, compiles the sources and starts the servers
  (using the [setup.sh](../setup.sh) script)
- It asks for the new root password to allow logging in (by default there is
  no root password set in containers)
- It provides web UI on a forwarded HTTPS port, [https://localhost:10443/]
- Starts a shell inside the container with root access for more testing or
  debugging.
