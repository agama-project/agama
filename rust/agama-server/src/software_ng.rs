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

pub(crate) mod backend;
pub(crate) mod web;

use std::sync::Arc;

use axum::Router;
use backend::SoftwareService;
pub use backend::SoftwareServiceError;
use tokio::sync::Mutex;

use crate::{products::ProductsRegistry, web::EventsSender};

pub async fn software_ng_service(
    events: EventsSender,
    products: Arc<Mutex<ProductsRegistry>>,
) -> Router {
    let client = SoftwareService::start(events, products)
        .await
        .expect("Could not start the software service.");
    web::software_router(client)
        .await
        .expect("Could not build the software router.")
}
