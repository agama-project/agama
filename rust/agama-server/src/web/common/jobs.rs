use std::{collections::HashMap, task::Poll};

use agama_lib::{
    dbus::get_optional_property,
    error::ServiceError,
    jobs::{client::JobsClient, Job},
    property_from_dbus,
};
use axum::{extract::State, routing::get, Json, Router};
use futures_util::{ready, Stream};
use pin_project::pin_project;
use tokio::sync::mpsc::unbounded_channel;
use tokio_stream::{wrappers::UnboundedReceiverStream, StreamExt};
use zbus::zvariant::{ObjectPath, OwnedObjectPath, OwnedValue};

use crate::{
    dbus::{DBusObjectChange, DBusObjectChangesStream, ObjectsCache},
    error::Error,
    web::Event,
};

use super::EventStreams;

/// Builds a router for the jobs objects.
pub async fn jobs_router<T>(
    dbus: &zbus::Connection,
    destination: &'static str,
    path: &'static str,
) -> Result<Router<T>, ServiceError> {
    let client = JobsClient::new(dbus.clone(), destination, path).await?;
    let state = JobsState { client };
    Ok(Router::new().route("/jobs", get(jobs)).with_state(state))
}

#[derive(Clone)]
struct JobsState<'a> {
    client: JobsClient<'a>,
}

async fn jobs(State(state): State<JobsState<'_>>) -> Result<Json<Vec<Job>>, Error> {
    let jobs = state
        .client
        .jobs()
        .await?
        .into_iter()
        .map(|(_path, job)| job)
        .collect();
    Ok(Json(jobs))
}

/// Returns the stream of jobs-related events.
///
/// The stream combines the following events:
///
/// * Changes on the DASD devices collection.
///
/// * `dbus`: D-Bus connection to use.
pub async fn jobs_stream(
    dbus: &zbus::Connection,
    manager: &'static str,
    namespace: &'static str,
) -> Result<EventStreams, Error> {
    let jobs_stream = JobsStream::new(dbus, manager, namespace).await?;
    let stream: EventStreams = vec![("jobs", Box::pin(jobs_stream))];
    Ok(stream)
}

#[pin_project]
pub struct JobsStream {
    dbus: zbus::Connection,
    cache: ObjectsCache<Job>,
    #[pin]
    inner: UnboundedReceiverStream<DBusObjectChange>,
}

#[derive(Debug, thiserror::Error)]
enum JobsStreamError {
    #[error("Service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Unknown job: {0}")]
    UnknownJob(OwnedObjectPath),
}

impl JobsStream {
    pub async fn new(
        dbus: &zbus::Connection,
        manager: &'static str,
        namespace: &'static str,
    ) -> Result<Self, ServiceError> {
        let (tx, rx) = unbounded_channel();
        let mut stream = DBusObjectChangesStream::new(
            dbus,
            &ObjectPath::from_static_str(manager)?,
            &ObjectPath::from_static_str(namespace)?,
            "org.opensuse.Agama.Storage1.Job",
        )
        .await?;

        tokio::spawn(async move {
            while let Some(change) = stream.next().await {
                let _ = tx.send(change);
            }
        });
        let rx = UnboundedReceiverStream::new(rx);

        let mut cache: ObjectsCache<Job> = Default::default();
        let client = JobsClient::new(dbus.clone(), manager, namespace).await?;
        for (path, job) in client.jobs().await? {
            cache.add(path.into(), job);
        }

        Ok(Self {
            dbus: dbus.clone(),
            cache,
            inner: rx,
        })
    }

    fn update_job<'a>(
        cache: &'a mut ObjectsCache<Job>,
        path: &OwnedObjectPath,
        values: &HashMap<String, OwnedValue>,
    ) -> Result<&'a Job, ServiceError> {
        let job = cache.find_or_create(path);
        property_from_dbus!(job, running, "Running", values, bool);
        property_from_dbus!(job, exit_code, "ExitCode", values, u32);
        Ok(job)
    }

    fn remove_job(
        cache: &mut ObjectsCache<Job>,
        path: &OwnedObjectPath,
    ) -> Result<Job, JobsStreamError> {
        cache
            .remove(path)
            .ok_or_else(|| JobsStreamError::UnknownJob(path.clone()))
    }

    fn handle_change(
        cache: &mut ObjectsCache<Job>,
        change: &DBusObjectChange,
    ) -> Result<Event, JobsStreamError> {
        match change {
            DBusObjectChange::Added(path, values) => {
                let job = Self::update_job(cache, path, values)?;
                Ok(Event::JobAdded { job: job.clone() })
            }
            DBusObjectChange::Changed(path, updated) => {
                let job = Self::update_job(cache, path, updated)?;
                Ok(Event::JobChanged { job: job.clone() })
            }
            DBusObjectChange::Removed(path) => {
                let job = Self::remove_job(cache, path)?;
                Ok(Event::JobRemoved { job })
            }
        }
    }
}

impl Stream for JobsStream {
    type Item = Event;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let mut pinned = self.project();

        Poll::Ready(loop {
            let change = ready!(pinned.inner.as_mut().poll_next(cx));
            let next_value = match change {
                Some(change) => {
                    if let Ok(event) = Self::handle_change(pinned.cache, &change) {
                        Some(event)
                    } else {
                        log::warn!("Could not process change {:?}", &change);
                        None
                    }
                }
                None => break None,
            };
            if next_value.is_some() {
                break next_value;
            }
        })
    }
}
