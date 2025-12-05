# Agama TUI

This package corresponds to the Hack Week 25 project
[Build a terminal user-interface (TUI) for Agama](https://hackweek.opensuse.org/projects/build-a-terminal-user-interface-tui-for-agama).

To be clear, it is just an experiment and providing a TUI is not in Agama's roadmap at this time.

## Description

Officially, Agama offers two different user interfaces. On the one hand, we have the web-based
interface, which is the one you see when you run the installation media. On the other hand, we have
a command-line interface. In both cases, you can use them using a remote system, either using a
browser or the agama CLI.

We would expect most of the cases to be covered by this approach. However, if you cannot use the
web-based interface and, for some reason, you cannot access the system through the network, your
only option is to use the CLI. This interface offers a mechanism to modify Agama's configuration
using an editor (vim, by default), but perhaps you might want to have a more user-friendly way.

## Goals

The main goal of this project is to built a minimal terminal user-interface for Agama. This
interface will allow the user to install the system providing just a few settings (selecting a
product, a storage device and a user password). Then it should report the installation progress.

## Daily progress

### Day 1

- Get familiar with Ratatui.
- Implement a basic UI that displays the list of products and the selected one.
- The UI is updated on server changes (`SystemChanged` and `ConfigChanged` by now).

### Day 2

- Simplify the interaction with the API.
- Extract product selection logic to a separate widget.

### Day 3

- Make it possible to run API actions in background.
- Add a pop-up when the API is busy.
- Refactor the code to split the state and the widgets, getting inspiration from
  [The Elm Architecture](https://ratatui.rs/concepts/application-patterns/the-elm-architecture/).

### Day 4

- The current architecture has a problem: the render methods are responsible for extracting
  the information from the API which is available behind a Mutex in the widget's state.
- We change the approach and now the widget state is responsible for extracting the
  information needed by the view. No more locks in the render function.
- Introduce a new storage page with different sections that you can navigate using Tab.

### Day 5

- Add a network page.
- Add a progress widget.
- Properly update the UI when the backend changes (it got broken at some point).

## Testing

The code is based on the [api-v2](https://github.com/agama-project/agama/tree/api-v2) of the Agama
project. You can run that code using the
[testing_using_container.sh script](https://github.com/agama-project/agama/blob/api-v2/testing_using_container.sh).

> [!NOTE] When running the container, you need to manually start the storage service.
>
> ```
> podman exec --tty --interactive agama agamactl storage
> ```

Alternatively, you can use the
[api-v2 ISO](https://download.opensuse.org/repositories/systemsmanagement:/Agama:/branches:/api-v2/images/iso/).
Beware that the web UI is not working in this case.

Once you start Agama, you can connect using the TUI (although you need to authenticate first):

```
cargo run --bin agama -- --host https://localhost:10443/ --insecure auth login
cargo run --bin agama-tui -- --host https://localhost:10443/ --insecure
```

If you are not using a container, replace the `https://localhost:10443/` with the URL of your Agama
instance.
