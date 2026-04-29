# Monitor Color Themes

The Agama monitor command supports different color themes for the terminal UI.

## Current Status

- **Default Theme**: Monochrome (black/white/gray only) - shipped by default
- **Colored Theme**: Available in code but not enabled (demonstrates how to add colored themes)

## Architecture

The theme system is centralized in `rust/agama-cli/src/monitor/theme.rs` using a simple, semantic color scheme:

```rust
pub struct Theme {
    pub background: Color,     // Status bar background
    pub busy_fg: Color,        // Active/busy state foreground
    pub busy_bg: Color,        // Active/busy state background
    pub idle_fg: Color,        // Idle state foreground
    pub idle_bg: Color,        // Idle state background
    pub warning_fg: Color,     // Warning/attention foreground
    pub warning_bg: Color,     // Warning/attention background
    pub error_fg: Color,       // Error/failed foreground
    pub error_bg: Color,       // Error/failed background
    pub accent: Color,         // Progress bars and highlights
}
```

Each widget receives a `&Theme` reference and uses the semantic colors based on the state being displayed.

## Adding a New Theme

To add a new color theme:

1. **Define the theme** in `rust/agama-cli/src/monitor/theme.rs`:

```rust
impl Theme {
    pub fn my_theme() -> Self {
        Self {
            background: Color::DarkGray,
            
            busy_fg: Color::Black,
            busy_bg: Color::Yellow,
            
            idle_fg: Color::Black,
            idle_bg: Color::Green,
            
            warning_fg: Color::Black,
            warning_bg: Color::Magenta,
            
            error_fg: Color::White,
            error_bg: Color::Red,
            
            accent: Color::Cyan,
        }
    }
}
```

2. **Use the theme** in `rust/agama-cli/src/monitor/app.rs`:

```rust
pub fn new(status: InstallationStatus) -> Self {
    Self {
        status,
        theme: Theme::my_theme(),  // Instead of Theme::default()
    }
}
```

## Future Enhancements

Possible improvements for theme support:

- Add a CLI flag to select themes: `agama monitor --theme colored`
- Store theme preference in configuration file
- Support custom theme files (JSON/TOML)
- Add more pre-defined themes (light, dark, high-contrast, etc.)

## Theme Color Reference

The theme uses semantic colors that are reused across different UI states:

- **`background`**: Status bar background
- **`busy_fg/busy_bg`**: Used for:
  - "BUSY" badge when work is in progress
  - "INSTALLING" phase badge
- **`idle_fg/idle_bg`**: Used for:
  - "IDLE" badge when nothing is happening
  - "CONFIGURING" phase badge
  - "FINISHED" phase badge
  - System info on the right side of status bar
- **`warning_fg/warning_bg`**: Used for:
  - "IDLE" badge when waiting for user action (issues/questions present)
- **`error_fg/error_bg`**: Used for:
  - "FAIL" badge
  - "FAILED" phase badge
- **`accent`**: Used for:
  - Progress bar gauge
  - Bullet points and highlights in content area
