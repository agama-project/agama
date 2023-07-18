use agama_settings::settings::Settings;
use agama_settings::{SettingObject, SettingValue, Settings, SettingsError};
use std::collections::HashMap;

/// Main settings
#[derive(Debug, Default, Settings)]
pub struct Main {
    product: Option<String>,
    #[settings(collection)]
    patterns: Vec<Pattern>,
}

/// Software patterns
#[derive(Debug, Clone)]
pub struct Pattern {
    id: String,
}

/// TODO: deriving this trait could be easy.
impl TryFrom<SettingObject> for Pattern {
    type Error = SettingsError;

    fn try_from(value: SettingObject) -> Result<Self, Self::Error> {
        match value.get("id") {
            Some(id) => Ok(Pattern {
                id: id.clone().try_into()?,
            }),
            _ => Err(SettingsError::MissingKey("id".to_string())),
        }
    }
}

#[test]
fn test_set() {
    let mut main = Main::default();
    main.set("product", SettingValue("Tumbleweed".to_string()))
        .unwrap();

    assert_eq!(main.product, Some("Tumbleweed".to_string()));
    assert!(matches!(
        main.set("missing", SettingValue("".to_string())),
        Err(SettingsError::UnknownAttribute(_))
    ));
}

#[test]
fn test_add() {
    let mut main = Main::default();
    let pattern = HashMap::from([("id".to_string(), SettingValue("base".to_string()))]);
    main.add("patterns", SettingObject(pattern)).unwrap();

    let pattern = main.patterns.first().unwrap();
    assert_eq!(pattern.id, "base");
}

#[test]
fn test_merge() {
    let mut main0 = Main {
        product: Some("Tumbleweed".to_string()),
        ..Default::default()
    };

    let patterns = vec![Pattern {
        id: "enhanced".to_string(),
    }];
    let main1 = Main {
        product: Some("ALP".to_string()),
        patterns,
    };

    main0.merge(&main1);
    assert_eq!(main0.product, Some("ALP".to_string()));
    assert_eq!(main0.patterns.len(), 1);
}
