## Troubleshooting Failed Integration Tests in CI

### Single Test Failure

There are artefacts in CI. Go to failed job and there is link ot "Summary". At the bottom of page there is "Artifacts" that contain
y2log and also trace.zip. Trace can be used locally or at page https://trace.playwright.dev/ to get overview of failure, how it looks and so on.

### Stuck at DBus Loading

It usually indicates issue with DInstaller DBus services. There are step called "Show D-Bus Services Logs" which should give hint what is going wrong.
Additional help can be y2log from artifacts ( for more about artifacts see above "Single Test Failure" ).

### Missing Package/Wrong Container

Packages lives in container at https://build.opensuse.org/package/show/YaST:Head:Containers/d-installer-testing . Feel free to modify it as its only intention
is CI testing.
