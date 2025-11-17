// Copyright (c) [2025] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! This module implements a set of utilities for tests.

use agama_locale_data::{KeymapId, LocaleId};
use agama_utils::{
    actor::Handler,
    api::{
        event,
        l10n::{Keymap, LocaleEntry, TimezoneEntry},
    },
    issue,
};

use crate::{
    model::{KeymapsDatabase, LocalesDatabase, TimezonesDatabase},
    service, Builder, ModelAdapter, Service,
};

/// Test adapter.
///
/// This adapter does not interact with systemd and/or D-Bus. It just
/// holds the databases and the given configuration.
#[derive(Default)]
pub struct TestModel {
    pub locales: LocalesDatabase,
    pub keymaps: KeymapsDatabase,
    pub timezones: TimezonesDatabase,
}

impl TestModel {
    /// Builds a new adapter with the given databases.
    ///
    // FIXME: why not use the default databases instead?
    pub fn new(
        locales: LocalesDatabase,
        keymaps: KeymapsDatabase,
        timezones: TimezonesDatabase,
    ) -> Self {
        Self {
            locales,
            keymaps,
            timezones,
        }
    }

    /// Builds a new adapter with some sample data.
    pub fn with_sample_data() -> Self {
        let locales = LocalesDatabase::with_entries(&[
            LocaleEntry {
                id: "en_US.UTF-8".parse().unwrap(),
                language: "English".to_string(),
                territory: "United States".to_string(),
                consolefont: None,
            },
            LocaleEntry {
                id: "es_ES.UTF-8".parse().unwrap(),
                language: "Spanish".to_string(),
                territory: "Spain".to_string(),
                consolefont: None,
            },
        ]);
        let keymaps = KeymapsDatabase::with_entries(&[
            Keymap::new("us".parse().unwrap(), "English"),
            Keymap::new("es".parse().unwrap(), "Spanish"),
        ]);
        let timezones = TimezonesDatabase::with_entries(&[
            TimezoneEntry {
                id: "Europe/Berlin".parse().unwrap(),
                parts: vec!["Europe".to_string(), "Berlin".to_string()],
                country: Some("Germany".to_string()),
            },
            TimezoneEntry {
                id: "Atlantic/Canary".parse().unwrap(),
                parts: vec!["Atlantic".to_string(), "Canary".to_string()],
                country: Some("Spain".to_string()),
            },
        ]);
        Self::new(locales, keymaps, timezones)
    }
}

impl ModelAdapter for TestModel {
    fn locales_db(&self) -> &LocalesDatabase {
        &self.locales
    }

    fn keymaps_db(&self) -> &KeymapsDatabase {
        &self.keymaps
    }

    fn timezones_db(&self) -> &TimezonesDatabase {
        &self.timezones
    }

    fn locale(&self) -> LocaleId {
        LocaleId::default()
    }

    fn keymap(&self) -> Result<KeymapId, service::Error> {
        Ok(KeymapId::default())
    }
}

/// Builds a sample service.
pub async fn build_service(
    events: event::Sender,
    issues: Handler<issue::Service>,
) -> Handler<Service> {
    let model = TestModel::with_sample_data();
    Builder::new(events, issues)
        .with_model(model)
        .spawn()
        .await
        .unwrap()
}
