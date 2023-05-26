use std::collections::HashMap;
use zbus::zvariant;

/// Nested hash to send to D-Bus.
pub type NestedHash<'a> = HashMap<&'a str, HashMap<&'a str, zvariant::Value<'a>>>;
/// Nested hash as it comes from D-Bus.
pub type OwnedNestedHash = HashMap<String, HashMap<String, zvariant::OwnedValue>>;
