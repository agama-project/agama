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

use crate::{
    model::{
        license::License, packages::Repository, pattern::Pattern, product::Product,
        registration::AddonProperties, ModelAdapter,
    },
    service,
};
use serde::Serialize;

/// Localization-related information of the system where the installer
/// is running.
#[derive(Clone, Debug, Default, Serialize)]
pub struct SystemInfo {
    /// List of known patterns.
    pub patterns: Vec<Pattern>,
    /// List of known repositories.
    pub repositories: Vec<Repository>,
    /// List of known products.
    pub products: Vec<Product>,
    /// List of known licenses
    pub licenses: Vec<License>,
    /// List of available addons to register
    pub addons: Vec<AddonProperties>,
}
