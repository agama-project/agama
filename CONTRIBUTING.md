# D-Installer Contribution Guidelines

This is an open source project and as such it welcomes all kinds of
contributions. If you decide to contribute, please follow these guidelines to
ensure the process is effective and pleasant both for you and the main
developers.

There are two main forms of contribution: providing feedback and performing code
changes.

## Feedback

This proof of concept is currently driven by the YaST development team. The
best way to reach us is at the [#yast](https://web.libera.chat/#yast) IRC
channel on libera.chat or using the [YaST development mailing
list](http://lists.opensuse.org/yast-devel/).

## Code Changes

We welcome all kinds of code contributions. However, before making any
non-trivial contribution, get in touch with us first — this can prevent wasted
effort on both sides. Also, have a look at the Code Structure section below.

To send us your code change, use GitHub pull requests. The workflow is as
follows:

  1. Fork the project.

  2. Create a topic branch based on `master`.

  3. Implement your change, including tests if possible.

  4. Publish the branch and create a pull request.

  5. YaST developers will review your change and possibly point out issues.
     Adapt the code under their guidance until they are all resolved.

  6. Finally, the pull request will get merged or rejected.

See also [GitHub's guide on
contributing](https://help.github.com/articles/fork-a-repo).

If you want to do multiple unrelated changes, use separate branches and pull
requests.

## Code Structure

This section contains a small unsorted list of the principles and guidelines we
are trying to observe while developing D-Installer.

The project is divided in two big parts that communicate with each other - the
installer service written in Ruby (code located at the `service` directory) and
the web interface written in Javascript that currently relies on the Cockpit
infrastructure for some operations (code at the `web` directory).

### Service Structure

The service part written in Ruby is separated into two layers, a backend (in the
Ruby namespace `DInstaller`) and the D-Bus interface on top (namespace
`DInstaller::DBus`). 

Although there can be only one installation in progress, the service is
structured to avoid the abuse of the Singleton programming pattern as mechanism
to share the state information. The classes containing the business logic (eg.
`DInstaller::Manager`, `DInstaller::Software`) are completely independent and
decoupled from the ones providing the D-Bus layer. When an object of the
`DInstaller::DBus` namespace is initialized, it receives the corresponding
business logic object as argument. That's more robust than making those business
logic objects singleton and allowing the D-Bus related ones to simply access
those singletons.
