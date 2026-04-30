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

use agama_lib::monitor::InstallationStatus;
use agama_utils::api::status::Stage;
use gettextrs::gettext;
use serde::Serialize;
use std::fmt;

/// A single enum representing current state of the installation process.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum InstallationEnum {
    /// The installation is currently proposing configuration.
    Proposing,
    /// The installation is waiting for a question to be answered.
    Question,
    /// The installation has issues blocking it from starting.
    Issues,
    /// The installation is ready to start.
    Ready,
    /// The installation is in progress.
    Installing,
    /// The installation finished successfully.
    Succeeded,
    /// The installation failed.
    Failed,
}

impl InstallationEnum {
    pub fn from_status(status: &InstallationStatus) -> Self {
        if status.status.stage == Stage::Finished {
            return Self::Succeeded;
        }
        if status.status.stage == Stage::Failed {
            return Self::Failed;
        }
        if !status.questions.is_empty() {
            return Self::Question;
        };
        if !status.issues.is_empty() {
            return Self::Issues;
        };
        if status.status.progresses.is_empty() {
            return Self::Ready;
        }
        if status.status.stage == Stage::Configuring {
            Self::Proposing
        } else {
            Self::Installing
        }
    }
}

impl fmt::Display for InstallationEnum {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let text = match self {
            Self::Failed => gettext("Installation failed."),
            Self::Succeeded => gettext("Installation finished successfully."),
            Self::Ready => gettext("Installation is ready to start."),
            Self::Installing => gettext("Installation is in progress."),
            Self::Proposing => gettext("Installation is being proposed."),
            Self::Question => gettext("There are unanswered questions. Please use `agama questions` command or web interface to answer them."),
            Self::Issues => gettext("The installer failed to calculate the installation proposal. There are issues blocking the installation."),
        };
        write!(f, "{}", text)
    }
}

/// Holds data for agama status command
#[derive(Debug, Serialize)]
pub struct StatusReport {
    /// current state of the installation process
    pub installation: InstallationEnum,
    /// more detailed data compiled from backend from status, questions and issues call
    #[serde(flatten)]
    pub data: InstallationStatus,
}

impl StatusReport {
    pub fn new(status: InstallationStatus) -> Self {
        let installation_enum = InstallationEnum::from_status(&status);
        Self {
            installation: installation_enum,
            data: status,
        }
    }
}

impl fmt::Display for StatusReport {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "{}", self.installation)?;
        writeln!(f)?;
        write!(f, "{}", gettext("Details:"))?;
        if !self.data.questions.is_empty() {
            write!(f, "\n{}", gettext("Open questions:"))?;
            for q in &self.data.questions {
                write!(f, "\n  - {}", q.spec.text)?;
            }
        }
        if !self.data.issues.is_empty() {
            write!(f, "\n{}", gettext("Blocking issues:"))?;
            for i in &self.data.issues {
                write!(f, "\n  - {}", i.issue.description)?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_utils::api::{
        self,
        issue::{Issue, IssueWithScope},
        progress::Progress,
        question::{Question, QuestionSpec},
        scope::Scope,
    };

    fn default_status() -> InstallationStatus {
        InstallationStatus {
            status: api::status::Status::default(),
            issues: vec![],
            questions: vec![],
        }
    }

    #[test]
    fn test_from_status_finished() {
        let mut status = default_status();
        status.status.stage = Stage::Finished;
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Succeeded
        );
    }

    #[test]
    fn test_from_status_failed() {
        let mut status = default_status();
        status.status.stage = Stage::Failed;
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Failed
        );
    }

    #[test]
    fn test_from_status_question() {
        let mut status = default_status();
        status
            .questions
            .push(Question::new(1, QuestionSpec::new("text", "class")));
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Question
        );
    }

    #[test]
    fn test_from_status_issues() {
        let mut status = default_status();
        status.issues.push(IssueWithScope {
            scope: Scope::Manager,
            issue: Issue::new("class", "description"),
        });
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Issues
        );
    }

    #[test]
    fn test_from_status_ready() {
        let status = default_status();
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Ready
        );
    }

    #[test]
    fn test_from_status_proposing() {
        let mut status = default_status();
        status.status.stage = Stage::Configuring;
        status
            .status
            .progresses
            .push(Progress::new(Scope::Manager, 1, "step".to_string()));
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Proposing
        );
    }

    #[test]
    fn test_from_status_installing() {
        let mut status = default_status();
        status.status.stage = Stage::Installing;
        status
            .status
            .progresses
            .push(Progress::new(Scope::Manager, 1, "step".to_string()));
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Installing
        );
    }

    #[test]
    fn test_status_report_new() {
        let status = default_status();
        let report = StatusReport::new(status.clone());
        assert_eq!(report.installation, InstallationEnum::Ready);
        assert_eq!(report.data, status);
    }

    #[test]
    fn test_from_status_precedence() {
        let mut status = default_status();

        status.status.stage = Stage::Configuring;
        status
            .status
            .progresses
            .push(Progress::new(Scope::Manager, 1, "step".to_string()));
        status.issues.push(IssueWithScope {
            scope: Scope::Manager,
            issue: Issue::new("class", "description"),
        });
        status
            .questions
            .push(Question::new(1, QuestionSpec::new("text", "class")));

        // Precedence 1: Question over issues and proposing
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Question
        );

        // Precedence 2: Issues over proposing
        status.questions.clear();
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Issues
        );

        // Precedence 3: Proposing over ready
        status.issues.clear();
        assert_eq!(
            InstallationEnum::from_status(&status),
            InstallationEnum::Proposing
        );
    }

    #[test]
    fn test_status_report_display_ready() {
        let status = default_status();
        let report = StatusReport::new(status);
        let output = report.to_string();
        assert!(output.contains("Installation is ready to start."));
        assert!(output.contains("Details:"));
        assert!(!output.contains("Open questions:"));
        assert!(!output.contains("Blocking issues:"));
    }

    #[test]
    fn test_status_report_display_with_issues_and_questions() {
        let mut status = default_status();
        status.issues.push(IssueWithScope {
            scope: Scope::Manager,
            issue: Issue::new("class1", "This is a blocking issue."),
        });
        status.questions.push(Question::new(
            1,
            QuestionSpec::new("What is your name?", "class2"),
        ));
        let report = StatusReport::new(status);
        let output = report.to_string();
        assert!(output.contains("There are unanswered questions."));
        assert!(output.contains("Details:"));
        assert!(output.contains("Open questions:\n  - What is your name?"));
        assert!(output.contains("Blocking issues:\n  - This is a blocking issue."));
    }
}
