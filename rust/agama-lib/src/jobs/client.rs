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
