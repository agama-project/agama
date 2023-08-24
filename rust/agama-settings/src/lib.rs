//! This module offers a mechanism to easily map the values from the command
//! line to proper installation settings.
//!
//! In Agama, the installation settings are modeled using structs with optional fields and vectors.
//! To specify a value in the command line, the user needs to specify:
//!
//! * a setting ID (`"users.name"`, `"storage.lvm"`, and so on), that must be used to find the
//!   setting.
//! * a value, which is captured as a string (`"Foo Bar"`, `"true"`, etc.) and it should be
//!   converted to the proper type.
//!
//! Implementing the [Settings](crate::settings::Settings) trait adds support for setting the value
//! in an straightforward way, taking care of the conversions automatically. The newtype
//! [SettingValue] takes care of such a conversion.
//!
//! ## Example
//!
//! The best way to understand how it works is to see it in action. In the example below, there is
//! a simplified `InstallSettings` struct that is composed by the user settings, which is another
//! struct, and a boolean field.
//!
//! In this case, the trait is automatically derived, implementing a `set` method that allows
//! setting configuration value by specifying:
//!
//! * An ID, like `users.name`.
//! * A string-based value, which is automatically converted to the corresponding type in the
//! struct.
//!
//! ```
//! use agama_settings::{Settings, settings::{SettingValue, Settings}};
//!
//! #[derive(Default, Settings)]
//! struct UserSettings {
//!   name: Option<String>,
//!   enabled: Option<bool>
//! }
//!
//! #[derive(Default, Settings)]
//! struct InstallSettings {
//!   #[settings(nested)]
//!   user: Option<UserSettings>,
//!   reboot: Option<bool>
//! }
//!
//! let user = UserSettings { name: Some(String::from("foo")), enabled: Some(false) };
//! let mut settings = InstallSettings { user: Some(user), reboot: None };
//!
//! settings.set("user.name", SettingValue("foo.bar".to_string()));
//! settings.set("user.enabled", SettingValue("true".to_string()));
//! settings.set("reboot", SettingValue("true".to_string()));
//!
//! let user = settings.user.unwrap();
//! assert_eq!(user.name, Some("foo.bar".to_string()));
//! assert_eq!(user.enabled, Some(true));
//! assert_eq!(settings.reboot, Some(true));
//! ```

pub mod error;
pub mod settings;

pub use self::error::SettingsError;
pub use self::settings::{SettingObject, SettingValue};
pub use agama_derive::Settings;
