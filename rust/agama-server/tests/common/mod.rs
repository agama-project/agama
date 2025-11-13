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















use agama_lib::error::ServiceError;







use agama_manager::service::Service as ManagerService;







use agama_server::server::server_service;







use agama_utils::actor;







use axum::Router;







use std::path::PathBuf;







use tokio::sync::broadcast::channel;















// NOTE: this is a temporary solution. Once the code is refactored to not







// depend on a real D-Bus connection, this function should be moved to a







// common testing module.







pub async fn build_server_service() -> Result<Router, ServiceError> {







    let share_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/share");







    std::env::set_var("AGAMA_SHARE_DIR", share_dir.display().to_string());















    let (tx, mut rx) = channel(16);















    tokio::spawn(async move {







        while let Ok(event) = rx.recv().await {







            println!("{:?}", event);







        }







    });















    let manager = ManagerService::new_mock(tx.clone()).await;







    server_service(tx, actor::spawn(manager)).await







}















pub async fn body_to_string(body: axum::body::Body) -> String {







    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();







    String::from_utf8_lossy(&bytes).to_string()







}














