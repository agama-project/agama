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

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum Policy {
    /// Automatically answer questions.
    Auto,
    /// Ask the user.
    User,
}

/// Data structure for single JSON answer. For variables specification see
/// corresponding [agama_lib::questions::GenericQuestion] fields.
/// The *matcher* part is: `class`, `text`, `data`.
/// The *answer* part is: `answer`, `password`.
#[derive(Clone, Serialize, Deserialize, PartialEq, Debug, utoipa::ToSchema)]
pub struct Answer {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// A matching GenericQuestion can have other data fields too
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<HashMap<String, String>>,
    /// The answer text is the only mandatory part of an Answer
    #[serde(alias = "action")]
    pub answer: String,
    /// All possible mixins have to be here, so they can be specified in an Answer
    #[serde(alias = "password")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

/// Questions configuration.
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy: Option<Policy>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answers: Option<Vec<Answer>>,
}
