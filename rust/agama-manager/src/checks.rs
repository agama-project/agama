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

//! Functions to check different conditions before commiting any action.

use agama_utils::{actor::Handler, api::status::Stage, issue, progress};

use crate::service::Error;

pub async fn check_issues(issues: &Handler<issue::Service>) -> Result<(), Error> {
    let issues = issues.call(issue::message::Get).await?;
    if !issues.is_empty() {
        return Err(Error::PendingIssues {
            issues: issues.clone(),
        });
    }
    Ok(())
}

pub async fn check_stage(
    progress: &Handler<progress::Service>,
    expected: Stage,
) -> Result<(), Error> {
    let current = progress.call(progress::message::GetStage).await?;
    if current != expected {
        return Err(Error::UnexpectedStage { expected, current });
    }
    Ok(())
}

pub async fn check_progress(progress: &Handler<progress::Service>) -> Result<(), Error> {
    let progress = progress.call(progress::message::GetProgress).await?;
    if !progress.is_empty() {
        return Err(Error::Busy {
            scopes: progress.iter().map(|p| p.scope).collect(),
        });
    }
    Ok(())
}
