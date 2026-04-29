# Theme Switching Example

## Quick Switch to Colored Theme

To switch from the default monochrome theme to the colored theme, edit `rust/agama-cli/src/monitor/app.rs`:

```rust
/// Creates a new MonitorApp from the initial status
pub fn new(status: InstallationStatus) -> Self {
    Self {
        status,
        theme: Theme::colored(),  // Change from Theme::default()
    }
}
```

## Creating a Custom Theme

Here's an example of creating a custom "ocean" theme:

```rust
// In rust/agama-cli/src/monitor/theme.rs

impl Theme {
    pub fn ocean() -> Self {
        Self {
            background: Color::Rgb(0, 31, 63),      // Dark blue
            
            busy_fg: Color::White,
            busy_bg: Color::Rgb(0, 119, 182),       // Medium blue
            
            idle_fg: Color::White,
            idle_bg: Color::Rgb(0, 87, 146),        // Darker blue
            
            warning_fg: Color::Black,
            warning_bg: Color::Rgb(0, 180, 216),    // Cyan-blue
            
            error_fg: Color::White,
            error_bg: Color::Rgb(192, 0, 0),        // Dark red
            
            accent: Color::Rgb(127, 219, 255),      // Light blue
        }
    }
}
```

Then use it in `rust/agama-cli/src/monitor/app.rs`:

```rust
theme: Theme::ocean(),
```

## Example: SUSE Green Theme

```rust
impl Theme {
    pub fn suse_green() -> Self {
        Self {
            background: Color::Rgb(48, 48, 48),     // Dark gray
            
            busy_fg: Color::Black,
            busy_bg: Color::Rgb(48, 186, 120),      // SUSE green
            
            idle_fg: Color::White,
            idle_bg: Color::Rgb(48, 48, 48),        // Dark gray
            
            warning_fg: Color::Black,
            warning_bg: Color::Rgb(255, 180, 0),    // Orange
            
            error_fg: Color::White,
            error_bg: Color::Rgb(204, 0, 0),        // Red
            
            accent: Color::Rgb(48, 186, 120),       // SUSE green
        }
    }
}
```

## Available Color Options

Ratatui supports:

- Named colors: `Color::Black`, `Color::White`, `Color::Red`, `Color::Green`, `Color::Yellow`, `Color::Blue`, `Color::Magenta`, `Color::Cyan`, `Color::Gray`, `Color::DarkGray`
- 256-color palette: `Color::Indexed(u8)`
- True color (RGB): `Color::Rgb(u8, u8, u8)`

For terminal compatibility, stick to named colors or 256-color palette. True color requires terminal support.
