// Copyright (c) [2024] SUSE LLC
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

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub generic: GenericQuestion,
    pub with_password: Option<QuestionWithPassword>,
}

/// Facade of agama_lib::questions::GenericQuestion
/// For fields details see it.
/// Reason why it does not use directly GenericQuestion from lib
/// is that it contain both question and answer. It works for dbus
/// API which has both as attributes, but web API separate
/// question and its answer. So here it is split into GenericQuestion
/// and GenericAnswer
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GenericQuestion {
    /// id is optional as newly created questions does not have it assigned
    pub id: Option<u32>,
    pub class: String,
    pub text: String,
    pub options: Vec<String>,
    pub default_option: String,
    pub data: HashMap<String, String>,
}

/// Facade of agama_lib::questions::WithPassword
/// For fields details see it.
/// Reason why it does not use directly WithPassword from lib
/// is that it is not composition as used here, but more like
/// child of generic question and contain reference to Base.
/// Here for web API we want to have in json that separation that would
/// allow to compose any possible future specialization of question.
/// Also note that question is empty as QuestionWithPassword does not
/// provide more details for question, but require additional answer.
/// Can be potentionally extended in future e.g. with list of allowed characters?
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuestionWithPassword {}

#[derive(Default, Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    pub generic: GenericAnswer,
    pub with_password: Option<PasswordAnswer>,
}

/// Answer needed for GenericQuestion
#[derive(Default, Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GenericAnswer {
    pub answer: String,
}

/// Answer needed for Password specific questions.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasswordAnswer {
    pub password: String,
}
