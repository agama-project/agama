use std::collections::HashMap;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct TimezoneIdPart {
    #[serde(rename(deserialize = "timezoneIdPartId"))]
    pub id: String,
    pub names: crate::localization::Localization
}

// Timezone id parts are useful mainly for localization of timezones
// Just search each part of timezone for translation
#[derive(Debug, Deserialize)]
pub struct TimezoneIdParts {
    #[serde(rename(deserialize = "timezoneIdPart"))]
    pub timezone_part: Vec<TimezoneIdPart>
}

impl TimezoneIdParts {
    /// Localized given list of timezones to given language
    /// # Examples
    /// 
    /// ```
    /// let parts = agama_locale_data::get_timezone_parts();
    /// let timezones = vec!["Europe/Prague".to_string(), "Europe/Berlin".to_string()];
    /// let result = vec!["Evropa/Praha".to_string(), "Evropa/Berlín".to_string()];
    /// assert_eq!(parts.localize_timezones("cs", timezones), result);
    /// ```
    pub fn localize_timezones(&self, language: &str, timezones: &Vec<String>) -> Vec<String> {
        let mapping = self.construct_mapping(language);
        timezones.iter().map(|tz| self.translate_timezone(&mapping, tz)).collect()
    }

    fn construct_mapping(&self, language: &str) -> HashMap<String, String> {
        let mut res: HashMap<String, String> = HashMap::with_capacity(self.timezone_part.len());
        self.timezone_part.iter()
          .map(|part| (part.id.clone(), part.names.name_for(language)))
          .for_each(|tuple| -> () {
            res.insert(tuple.0, tuple.1);
          }
        );
        return res
    }

    fn translate_timezone(&self, mapping: &HashMap<String, String>, timezone: &str) -> String {
        eprintln!("{timezone}");
        timezone.split("/")
        .map(|tzp| mapping.get(&tzp.to_string()).expect(format!("Unknown timezone part {tzp}").as_str()).to_owned())
        .collect::<Vec<String>>().join("/")
    }
}