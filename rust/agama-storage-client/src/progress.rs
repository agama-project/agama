// Copyright (c) [2026] SUSE LLC
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

//! Progress payload types for storage D-Bus signals.

use agama_utils::api::{Progress, Scope};
use serde::Deserialize;

/// Progress payload received over D-Bus from the storage service.
#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct ProgressData {
    pub size: usize,
    pub steps: Vec<String>,
    pub step: String,
    pub index: usize,
}

impl ProgressData {
    /// Converts the data into an `api::Progress` with the given scope.
    pub fn to_progress(&self, scope: Scope) -> Progress {
        Progress {
            scope,
            size: self.size,
            steps: self.steps.clone(),
            step: self.step.clone(),
            index: self.index,
        }
    }

    /// Deserializes a JSON progress string received from D-Bus into an `api::Progress`.
    pub fn parse(serialized: &str, scope: Scope) -> Result<Progress, serde_json::Error> {
        let data: Self = serde_json::from_str(serialized)?;
        Ok(data.to_progress(scope))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress_data() {
        let json = r#"{"size": 3, "steps": ["step 1", "step 2"], "step": "step 1", "index": 1}"#;
        let progress = ProgressData::parse(json, Scope::ISCSI).unwrap();
        assert_eq!(progress.scope, Scope::ISCSI);
        assert_eq!(progress.size, 3);
        assert_eq!(progress.steps, vec!["step 1", "step 2"]);
        assert_eq!(progress.step, "step 1");
        assert_eq!(progress.index, 1);
    }
}
