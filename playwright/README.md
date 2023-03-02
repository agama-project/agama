## Troubleshooting Failed Integration Tests in CI

### Single Test Failure

There are stored artifacts in the GitHub CI. Go to the failed job and there is
a link "Summary". At the bottom of the page there is "Artifacts" section which
contains the `y2log` and also `trace.zip` file. The trace can be browsed using
the playwright tool locally or at page https://trace.playwright.dev/ to get
details of the failure.

### Stuck at D-Bus Loading

It usually indicates an issue with the D-Installer D-Bus services. There is a step
called "Show D-Bus Services Logs" which should give a hint what is going wrong.
Additional help can be the `y2log` file in the artifacts (see above).

### Missing Package/Wrong Container

Packages lives in container at https://build.opensuse.org/package/show/YaST:Head:Containers/d-installer-testing .
Feel free to modify it as the only purpose of this container is CI testing.
