# Agama Network TUI

This is a TUI for configuring the network in Agama, specifically designed for `dracut` environments.

## Features

- Uses `ratatui` with `crossterm` backend (no `ncurses` dependency).
- Works in environments without `ncurses` support, like the `s390x` console.
- Displays network interfaces and their current state.
- Supports basic DHCP configuration.

## Usage

Run the binary:
```bash
./agama-network-tui
```

### Keybindings

- `Up/Down`: Navigate through interfaces.
- `d`: Configure the selected interface with DHCP.
- `q`: Quit.
