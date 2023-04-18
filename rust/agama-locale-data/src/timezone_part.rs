use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TimezoneIdPart {
    #[serde(rename(deserialize = "timezoneIdPartId"))]
    pub id: String
}

// Timezone id parts are useful mainly for localization of timezones
// Just search each part of timezone for translation
#[derive(Debug, Deserialize)]
pub struct TimezoneIdParts {
    #[serde(rename(deserialize = "timezoneIdPart"))]
    pub timezone_part: Vec<TimezoneIdPart>
}