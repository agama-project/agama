use zbus::{dbus_interface, Connection, InterfaceRef, SignalContext};
use crate::error::Error;

pub struct Progress {
    iface_ref: Option<InterfaceRef<Progress>>,
    total_steps: u8,
    current_step: Option<Step>,
}

#[derive(Clone)]
struct Step(u8, String);

impl Default for Step {
    fn default() -> Self {
        Step(0, String::new())
    }
}

type ProgressResult = Result<(), Error>;

impl Progress {
    pub fn new() -> Self {
        Self {
            iface_ref: None,
            total_steps: 0,
            current_step: None
        }
    }

    pub fn set_iface_ref(&mut self, iface_ref: InterfaceRef<Self>) {
        self.iface_ref = Some(iface_ref);
    }

    pub async fn start(&mut self, total_steps: u8) -> ProgressResult {
        self.set_total_steps(total_steps).await?;
        self.set_current_step(None).await?;
        Ok(())
    }

    pub async fn step(&mut self, description: String) -> ProgressResult {
        let Step(index, _) = self.current_step.clone().unwrap_or_default();
        self.set_current_step(Some(Step(index + 1, description))).await
    }

    pub async fn finish(&mut self) -> ProgressResult {
        self.set_total_steps(0).await?;
        self.set_current_step(None).await?;
        Ok(())
    }

    async fn set_total_steps(&mut self, value: u8) -> ProgressResult {
        self.total_steps = value;
        self.total_steps_signal().await
    }

    async fn set_current_step(&mut self, step: Option<Step>) -> ProgressResult {
        self.current_step = step;
        self.current_step_signal().await
    }

    async fn total_steps_signal(&self) -> ProgressResult {
        if let Some(signal_context) = self.signal_context() {
            self.total_steps_changed(signal_context).await?;
        }
        Ok(())
    }

    async fn current_step_signal(&self) -> ProgressResult {
        if let Some(signal_context) = self.signal_context() {
            self.current_step_changed(signal_context).await?;
        }
        Ok(())
    }

    fn signal_context(&self) -> Option<&SignalContext> {
        self.iface_ref
            .as_ref()
            .and_then(|iref| Some(iref.signal_context()))
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Progress")]
impl Progress {
    #[dbus_interface(property)]
    fn total_steps(&self) -> u8 {
        self.total_steps
    }

    #[dbus_interface(property)]
    fn current_step(&self) -> (u8, String) {
        let Step(index, description) = self.current_step.clone().unwrap_or_default();
        (index, description)
    }
}

pub async fn export_interface(
    connection: &Connection,
    path: &str,
) -> Result<InterfaceRef<Progress>, Box<dyn std::error::Error>> {
    let progress = Progress::new();
    connection.object_server().at(path, progress).await?;

    let iface_ref = connection.object_server().interface::<_, Progress>(path).await?;
    let mut iface = iface_ref.get_mut().await;
    iface.set_iface_ref(iface_ref.clone());

    Ok(iface_ref.clone())
}
