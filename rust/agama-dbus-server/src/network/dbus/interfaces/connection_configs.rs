use agama_lib::network::types::SSID;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::{mpsc::UnboundedSender, oneshot, Mutex, MutexGuard};
use uuid::Uuid;
use zbus::dbus_interface;

use crate::network::{
    action::Action,
    error::NetworkStateError,
    model::{BondConfig, SecurityProtocol, WirelessConfig, WirelessMode},
};

use super::common::{ConnectionConfigInterface, ConnectionInterface};

/// D-Bus interface for Bond settings.
pub struct Bond {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    uuid: Uuid,
}

impl Bond {
    /// Creates a Bond interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `uuid`: connection UUID.
    pub fn new(actions: UnboundedSender<Action>, uuid: Uuid) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            uuid,
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Bond")]
impl Bond {
    /// Bonding mode.
    #[dbus_interface(property)]
    pub async fn mode(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config::<BondConfig>().await?;
        Ok(config.mode.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mode = mode.try_into()?;
        self.update_config::<BondConfig, _>(|c| c.mode = mode)
            .await?;
        Ok(())
    }

    /// List of bonding options.
    #[dbus_interface(property)]
    pub async fn options(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config::<BondConfig>().await?;
        Ok(config.options.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_options(&mut self, opts: &str) -> zbus::fdo::Result<()> {
        let opts = opts.try_into()?;
        self.update_config::<BondConfig, _>(|c| c.options = opts)
            .await?;
        Ok(())
    }

    /// List of bond ports.
    ///
    /// For the port names, it uses the interface name (preferred) or, as a fallback,
    /// the connection ID of the port.
    #[dbus_interface(property)]
    pub async fn ports(&self) -> zbus::fdo::Result<Vec<String>> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions.send(Action::GetController(self.uuid, tx)).unwrap();

        let (_, ports) = rx.await.unwrap()?;
        Ok(ports)
    }

    #[dbus_interface(property)]
    pub async fn set_ports(&mut self, ports: Vec<String>) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        let (tx, rx) = oneshot::channel();
        actions
            .send(Action::SetPorts(self.uuid, Box::new(ports), tx))
            .unwrap();
        let result = rx.await.unwrap();
        Ok(result?)
    }
}

#[async_trait]
impl ConnectionInterface for Bond {
    fn uuid(&self) -> Uuid {
        self.uuid
    }

    async fn actions(&self) -> MutexGuard<UnboundedSender<Action>> {
        self.actions.lock().await
    }
}

impl ConnectionConfigInterface for Bond {}

/// D-Bus interface for wireless settings
pub struct Wireless {
    actions: Arc<Mutex<UnboundedSender<Action>>>,
    uuid: Uuid,
}

impl Wireless {
    /// Creates a Wireless interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `uuid`: connection UUID.
    pub fn new(actions: UnboundedSender<Action>, uuid: Uuid) -> Self {
        Self {
            actions: Arc::new(Mutex::new(actions)),
            uuid,
        }
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.Wireless")]
impl Wireless {
    /// Network SSID.
    #[dbus_interface(property, name = "SSID")]
    pub async fn ssid(&self) -> zbus::fdo::Result<Vec<u8>> {
        let config = self.get_config::<WirelessConfig>().await?;
        Ok(config.ssid.into())
    }

    #[dbus_interface(property, name = "SSID")]
    pub async fn set_ssid(&mut self, ssid: Vec<u8>) -> zbus::fdo::Result<()> {
        self.update_config::<WirelessConfig, _>(|c| c.ssid = SSID(ssid))
            .await?;
        Ok(())
    }

    /// Wireless connection mode.
    ///
    /// Possible values: "unknown", "adhoc", "infrastructure", "ap" or "mesh".
    ///
    /// See [crate::network::model::WirelessMode].
    #[dbus_interface(property)]
    pub async fn mode(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config::<WirelessConfig>().await?;
        Ok(config.mode.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_mode(&mut self, mode: &str) -> zbus::fdo::Result<()> {
        let mode: WirelessMode = mode.try_into()?;
        self.update_config::<WirelessConfig, _>(|c| c.mode = mode)
            .await?;
        Ok(())
    }

    /// Password to connect to the wireless network.
    #[dbus_interface(property)]
    pub async fn password(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config::<WirelessConfig>().await?;
        Ok(config.password.unwrap_or_default())
    }

    #[dbus_interface(property)]
    pub async fn set_password(&mut self, password: String) -> zbus::fdo::Result<()> {
        self.update_config::<WirelessConfig, _>(|c| {
            c.password = if password.is_empty() {
                None
            } else {
                Some(password)
            };
        })
        .await?;
        Ok(())
    }

    /// Wireless security protocol.
    ///
    /// Possible values: "none", "owe", "ieee8021x", "wpa-psk", "sae", "wpa-eap",
    /// "wpa-eap-suite-b192".
    ///
    /// See [crate::network::model::SecurityProtocol].
    #[dbus_interface(property)]
    pub async fn security(&self) -> zbus::fdo::Result<String> {
        let config = self.get_config::<WirelessConfig>().await?;
        Ok(config.security.to_string())
    }

    #[dbus_interface(property)]
    pub async fn set_security(&mut self, security: &str) -> zbus::fdo::Result<()> {
        let security: SecurityProtocol = security
            .try_into()
            .map_err(|_| NetworkStateError::InvalidSecurityProtocol(security.to_string()))?;
        self.update_config::<WirelessConfig, _>(|c| c.security = security)
            .await?;
        Ok(())
    }
}

#[async_trait]
impl ConnectionInterface for Wireless {
    fn uuid(&self) -> Uuid {
        self.uuid
    }

    async fn actions(&self) -> MutexGuard<UnboundedSender<Action>> {
        self.actions.lock().await
    }
}

impl ConnectionConfigInterface for Wireless {}
