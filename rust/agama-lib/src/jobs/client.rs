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

//! Implements a client to access Agama's Jobs API.

use zbus::{fdo::ObjectManagerProxy, zvariant::OwnedObjectPath, Connection};

use crate::error::ServiceError;

use super::Job;

#[derive(Clone)]
pub struct JobsClient<'a> {
    object_manager_proxy: ObjectManagerProxy<'a>,
}

impl<'a> JobsClient<'a> {
    pub async fn new(
        connection: Connection,
        destination: &'static str,
        path: &'static str,
    ) -> Result<Self, ServiceError> {
        let object_manager_proxy = ObjectManagerProxy::builder(&connection)
            .destination(destination)?
            .path(path)?
            .build()
            .await?;

        Ok(Self {
            object_manager_proxy,
        })
    }

    pub async fn jobs(&self) -> Result<Vec<(OwnedObjectPath, Job)>, ServiceError> {
        let managed_objects = self.object_manager_proxy.get_managed_objects().await?;

        let mut jobs = vec![];
        for (path, ifaces) in managed_objects {
            let Some(properties) = ifaces.get("org.opensuse.Agama.Storage1.Job") else {
                continue;
            };

            match Job::try_from(properties) {
                Ok(mut job) => {
                    job.id = path.to_string();
                    jobs.push((path, job));
                }
                Err(error) => {
                    log::warn!("Not a valid job: {}", error);
                }
            }
        }

        Ok(jobs)
    }
}
