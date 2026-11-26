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

//! Checks the questions part of the profile schema, generated from the types of the API.

pub mod common;
use agama_lib::profile::{ProfileValidator, ValidationOutcome};
use serde_json::json;

async fn validator() -> ProfileValidator {
    common::build_test_validator("Config").await
}

async fn validate(profile: serde_json::Value) -> ValidationOutcome {
    validator()
        .await
        .validate_str(&profile.to_string())
        .unwrap()
}

#[tokio::test]
async fn test_question_answer_accepts_action_key() {
    let profile = json!({
        "questions": {
            "answers": [
                {
                    "class": "luksActivation",
                    "action": "ok"
                }
            ]
        }
    });
    assert!(matches!(validate(profile).await, ValidationOutcome::Valid));
}

#[tokio::test]
async fn test_question_answer_accepts_deprecated_answer_alias() {
    let profile = json!({
        "questions": {
            "answers": [
                {
                    "class": "luksActivation",
                    "answer": "ok"
                }
            ]
        }
    });
    let outcome = validate(profile).await;
    assert!(
        matches!(outcome, ValidationOutcome::Valid),
        "Expected valid profile with 'answer' alias, got: {outcome:?}"
    );
}

#[tokio::test]
async fn test_question_answer_accepts_deprecated_answer_and_password_alias() {
    let profile = json!({
        "questions": {
            "answers": [
                {
                    "class": "luksActivation",
                    "answer": "ok",
                    "password": "secret"
                }
            ]
        }
    });
    let outcome = validate(profile).await;
    assert!(
        matches!(outcome, ValidationOutcome::Valid),
        "Expected valid profile with 'answer' and 'password' aliases, got: {outcome:?}"
    );
}

#[tokio::test]
async fn test_question_answer_rejects_both_action_and_answer() {
    let profile = json!({
        "questions": {
            "answers": [
                {
                    "class": "luksActivation",
                    "action": "ok",
                    "answer": "ok"
                }
            ]
        }
    });
    let outcome = validate(profile).await;
    assert!(
        matches!(outcome, ValidationOutcome::NotValid(_)),
        "Expected rejection when both 'action' and 'answer' are provided, got: {outcome:?}"
    );
}

/// Regression test for https://github.com/agama-project/agama/issues/4235
#[tokio::test]
async fn test_regression_issue_4235_gpg_import_answers() {
    let profile = json!({
        "questions": {
            "policy": "auto",
            "answers": [
                {
                    "answer": "Trust",
                    "class": "software.import_gpg",
                    "data": {
                        "fingerprint": "A82B 0141 8DEC D0E3 AE14 191F A9E1 51BB 0B24 5AF7"
                    }
                },
                {
                    "answer": "Trust",
                    "class": "software.import_gpg",
                    "data": {
                        "fingerprint": "BF3F 9A67 D3A2 FF98 A73F 5E07 488C 583D 287A 0027"
                    }
                }
            ]
        }
    });
    let outcome = validate(profile).await;
    assert!(
        matches!(outcome, ValidationOutcome::Valid),
        "Expected originally reported profile from #4235 to be valid, got: {outcome:?}"
    );
}
