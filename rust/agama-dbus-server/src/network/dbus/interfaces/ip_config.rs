//! Network D-Bus interfaces for IP configuration.
//!
//! This module contains the D-Bus interfaces to deal with IPv4 and IPv6 configuration.
//! The `dbus_interface` macro should be applied to structs, that's the reason there are
//! two different structs for IPv4 and IPv6 settings. The common code have been moved
//! to the `Ip<T>` struct.
use crate::network::{
    action::Action,
    model::{
        Connection as NetworkConnection, IpAddress, IpConfig, IpMethod, Ipv4Config, Ipv6Config,
    },
};
use async_std::{channel::Sender, sync::Arc};
use futures::lock::{MappedMutexGuard, Mutex, MutexGuard};
use std::{
    fmt::Display,
    marker::PhantomData,
    net::{Ipv4Addr, Ipv6Addr},
};
use zbus::dbus_interface;

pub trait IpMarker {}
impl IpMarker for Ipv4Addr {}
impl IpMarker for Ipv6Addr {}

/// D-Bus interface for IPv4 settings
pub struct Ip<T: IpMarker> {
    actions: Arc<Mutex<Sender<Action>>>,
    connection: Arc<Mutex<NetworkConnection>>,
    _owns: PhantomData<T>,
}

impl<T: IpMarker> Ip<T> {
    /// Returns the underlying connection.
    async fn get_connection(&self) -> MutexGuard<NetworkConnection> {
        self.connection.lock().await
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `connection`: Updated connection.
    async fn update_connection<'a>(
        &self,
        connection: MutexGuard<'a, NetworkConnection>,
    ) -> zbus::fdo::Result<()> {
        let actions = self.actions.lock().await;
        actions
            .send(Action::UpdateConnection(connection.clone()))
            .await
            .unwrap();
        Ok(())
    }

    fn addresses_from<U>(&self, ip: &IpConfig<U>) -> Vec<String>
    where
        U: Display,
    {
        ip.addresses.iter().map(|a| a.to_string()).collect()
    }

    fn nameservers_from<U>(&self, ip: &IpConfig<U>) -> Vec<String>
    where
        U: Display,
    {
        ip.nameservers.iter().map(|a| a.to_string()).collect()
    }

    /// Extracts the gateway from an IP config in textual form.
    fn gateway_from<U>(&self, ip: &IpConfig<U>) -> String
    where
        U: Display,
    {
        match ip.gateway {
            Some(ref addr) => addr.to_string(),
            None => "".to_string(),
        }
    }
}

impl Ip<Ipv4Addr> {
    /// Returns the IpConfig struct for IPv4.
    async fn get_ip_config(&self) -> MappedMutexGuard<NetworkConnection, Ipv4Config> {
        MutexGuard::map(self.get_connection().await, |c| c.ipv4_mut())
    }

    /// Updates the IpConfig struct for IPv4.
    ///
    /// * `func`: function to update the configuration.
    async fn update_config<F>(&self, func: F) -> zbus::fdo::Result<()>
    where
        F: Fn(&mut Ipv4Config),
    {
        let mut connection = self.get_connection().await;
        func(connection.ipv4_mut());
        self.update_connection(connection).await?;
        Ok(())
    }
}

pub struct Ipv4(Ip<Ipv4Addr>);

impl Ipv4 {
    /// Creates an IPv4 interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(actions: Sender<Action>, connection: Arc<Mutex<NetworkConnection>>) -> Self {
        let ip_interface: Ip<Ipv4Addr> = Ip {
            actions: Arc::new(Mutex::new(actions)),
            connection,
            _owns: PhantomData,
        };
        Ipv4(ip_interface)
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.IPv4")]
impl Ipv4 {
    /// List of IP addresses.
    ///
    /// When the method is 'auto', these addresses are used as additional addresses.
    #[dbus_interface(property)]
    pub async fn addresses(&self) -> Vec<String> {
        let ip_config = self.0.get_ip_config().await;
        self.0.addresses_from::<Ipv4Addr>(&ip_config)
    }

    #[dbus_interface(property)]
    pub async fn set_addresses(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        let addresses = helpers::parse_addresses::<IpAddress<Ipv4Addr>>(addresses);
        self.0
            .update_config(|ip| ip.addresses = addresses.clone())
            .await
    }

    /// IP configuration method.
    ///
    /// Possible values: "disabled", "auto", "manual" or "link-local".
    ///
    /// See [crate::network::model::IpMethod].
    #[dbus_interface(property)]
    pub async fn method(&self) -> String {
        let ip_config = self.0.get_ip_config().await;
        ip_config.method.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_method(&mut self, method: &str) -> zbus::fdo::Result<()> {
        let method: IpMethod = method.parse()?;
        self.0.update_config(|ip| ip.method = method).await
    }

    /// Name server addresses.
    #[dbus_interface(property)]
    pub async fn nameservers(&self) -> Vec<String> {
        let ip_config = self.0.get_ip_config().await;
        self.0.nameservers_from::<Ipv4Addr>(&ip_config)
    }

    #[dbus_interface(property)]
    pub async fn set_nameservers(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        let addresses = helpers::parse_addresses::<Ipv4Addr>(addresses);
        self.0
            .update_config(|ip| ip.nameservers = addresses.clone())
            .await
    }

    /// Network gateway.
    ///
    /// An empty string removes the current value. It is not possible to set a gateway if the
    /// Addresses property is empty.
    #[dbus_interface(property)]
    pub async fn gateway(&self) -> String {
        let ip_config = self.0.get_ip_config().await;
        self.0.gateway_from(&ip_config)
    }

    #[dbus_interface(property)]
    pub async fn set_gateway(&mut self, gateway: String) -> zbus::fdo::Result<()> {
        let gateway = helpers::parse_gateway::<Ipv4Addr>(gateway)?;
        self.0.update_config(|ip| ip.gateway = gateway).await
    }
}

impl Ip<Ipv6Addr> {
    /// Returns the IpConfig struct for IPv6.
    async fn get_ip_config(&self) -> MappedMutexGuard<NetworkConnection, Ipv6Config> {
        MutexGuard::map(self.get_connection().await, |c| c.ipv6_mut())
    }

    /// Updates the IpConfig struct for IPv6.
    ///
    /// * `func`: function to update the configuration.
    async fn update_config<F>(&self, func: F) -> zbus::fdo::Result<()>
    where
        F: Fn(&mut Ipv6Config),
    {
        let mut connection = self.get_connection().await;
        func(connection.ipv6_mut());
        self.update_connection(connection).await?;
        Ok(())
    }
}

pub struct Ipv6(Ip<Ipv6Addr>);

impl Ipv6 {
    /// Creates an IPv4 interface object.
    ///
    /// * `actions`: sending-half of a channel to send actions.
    /// * `connection`: connection to expose over D-Bus.
    pub fn new(actions: Sender<Action>, connection: Arc<Mutex<NetworkConnection>>) -> Self {
        let ip_interface: Ip<Ipv6Addr> = Ip {
            actions: Arc::new(Mutex::new(actions)),
            connection,
            _owns: PhantomData,
        };
        Ipv6(ip_interface)
    }
}

#[dbus_interface(name = "org.opensuse.Agama1.Network.Connection.IPv6")]
impl Ipv6 {
    /// List of IP addresses.
    ///
    /// When the method is 'auto', these addresses are used as additional addresses.
    #[dbus_interface(property)]
    pub async fn addresses(&self) -> Vec<String> {
        let ip_config = self.0.get_ip_config().await;
        self.0.addresses_from::<Ipv6Addr>(&ip_config)
    }

    #[dbus_interface(property)]
    pub async fn set_addresses(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        let addresses = helpers::parse_addresses::<IpAddress<Ipv6Addr>>(addresses);
        self.0
            .update_config(|ip| ip.addresses = addresses.clone())
            .await
    }

    /// IP configuration method.
    ///
    /// Possible values: "disabled", "auto", "manual" or "link-local".
    ///
    /// See [crate::network::model::IpMethod].
    #[dbus_interface(property)]
    pub async fn method(&self) -> String {
        let ip_config = self.0.get_ip_config().await;
        ip_config.method.to_string()
    }

    #[dbus_interface(property)]
    pub async fn set_method(&mut self, method: &str) -> zbus::fdo::Result<()> {
        let method: IpMethod = method.parse()?;
        self.0.update_config(|ip| ip.method = method).await
    }

    /// Name server addresses.
    #[dbus_interface(property)]
    pub async fn nameservers(&self) -> Vec<String> {
        let ip_config = self.0.get_ip_config().await;
        self.0.nameservers_from::<Ipv6Addr>(&ip_config)
    }

    #[dbus_interface(property)]
    pub async fn set_nameservers(&mut self, addresses: Vec<String>) -> zbus::fdo::Result<()> {
        let addresses = helpers::parse_addresses::<Ipv6Addr>(addresses);
        self.0
            .update_config(|ip| ip.nameservers = addresses.clone())
            .await
    }

    /// Network gateway.
    ///
    /// An empty string removes the current value. It is not possible to set a gateway if the
    /// Addresses property is empty.
    #[dbus_interface(property)]
    pub async fn gateway(&self) -> String {
        let ip_config = self.0.get_ip_config().await;
        self.0.gateway_from(&ip_config)
    }

    #[dbus_interface(property)]
    pub async fn set_gateway(&mut self, gateway: String) -> zbus::fdo::Result<()> {
        let gateway = helpers::parse_gateway::<Ipv6Addr>(gateway)?;
        self.0.update_config(|ip| ip.gateway = gateway).await
    }
}

mod helpers {
    use crate::network::error::NetworkStateError;
    use log;
    use std::{
        fmt::{Debug, Display},
        str::FromStr,
    };

    /// Parses a set of addresses in textual form into T.
    ///
    /// * `addresses`: addresses to parse.
    pub fn parse_addresses<T>(addresses: Vec<String>) -> Vec<T>
    where
        T: FromStr,
        <T as FromStr>::Err: Display,
    {
        addresses
            .into_iter()
            .filter_map(|ip| match ip.parse::<T>() {
                Ok(address) => Some(address),
                Err(error) => {
                    log::error!("Ignoring the invalid IP address: {} ({})", ip, error);
                    None
                }
            })
            .collect()
    }

    /// Sets the gateway for an IP configuration.
    ///
    /// * `ip`: IpConfig object.
    /// * `gateway`: IP in textual form.
    pub fn parse_gateway<T>(gateway: String) -> Result<Option<T>, NetworkStateError>
    where
        T: FromStr,
        <T as FromStr>::Err: Debug + Display,
    {
        if gateway.is_empty() {
            Ok(None)
        } else {
            let parsed = gateway
                .parse()
                .map_err(|_| NetworkStateError::InvalidIpAddr(gateway))?;
            Ok(Some(parsed))
        }
    }
}
