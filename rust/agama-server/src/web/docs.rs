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

use utoipa::openapi::{Components, Info, InfoBuilder, OpenApi, OpenApiBuilder, Paths};

mod network;
pub use network::NetworkApiDocBuilder;
mod storage;
pub use storage::StorageApiDocBuilder;
mod software;
pub use software::SoftwareApiDocBuilder;
mod l10n;
pub use l10n::L10nApiDocBuilder;
mod questions;
pub use questions::QuestionsApiDocBuilder;
mod manager;
pub use manager::ManagerApiDocBuilder;
mod users;
pub use users::UsersApiDocBuilder;
mod misc;
pub use misc::MiscApiDocBuilder;
pub mod common;

pub trait ApiDocBuilder {
    fn title(&self) -> String {
        "Agama HTTP API".to_string()
    }

    fn paths(&self) -> Paths;

    fn components(&self) -> Components;

    fn info(&self) -> Info {
        InfoBuilder::new()
            .title(self.title())
            .version("0.1.0")
            .build()
    }

    fn nested(&self) -> Option<OpenApi> {
        None
    }

    fn build(&self) -> utoipa::openapi::OpenApi {
        let mut api = OpenApiBuilder::new()
            .info(self.info())
            .paths(self.paths())
            .components(Some(self.components()))
            .build();

        if let Some(nested) = self.nested() {
            api.merge(nested);
        }
        api
    }
}
