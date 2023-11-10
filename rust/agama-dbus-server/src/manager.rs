use crate::dbus::interfaces::progress::{export_interface, Progress};
use zbus::{dbus_interface, Connection, InterfaceRef};
use crate::error::Error;

pub struct Manager {
    progress_ref: InterfaceRef<Progress>,
}

impl Manager {
    pub fn new(progress_ref: InterfaceRef<Progress>) -> Self {
        Self {
            progress_ref,
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Manager")]
impl Manager {
    pub async fn probe(&mut self) -> Result<(), Error> {
        let mut progress = self.progress_ref.get_mut().await;

        // TODO
        progress.start(2).await?;
        progress.step("step 1".to_string()).await?;
        progress.step("step 2".to_string()).await?;
        progress.finish().await?;

        Ok(())
    }
}

pub async fn export_dbus_objects(
    connection: &Connection,
) -> Result<(), Box<dyn std::error::Error>> {
    const PATH: &str = "/org/opensuse/Agama1";

    let progress_ref = export_interface(connection, PATH).await?;
    let manager = Manager::new(progress_ref);
    connection.object_server().at(PATH, manager).await?;

    Ok(())
}
