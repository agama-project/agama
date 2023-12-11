mod common;

use self::common::{async_retry, DBusServer};
use agama_dbus_server::network::{
    self,
    model::{self, Ipv4Method, Ipv6Method},
    Adapter, NetworkService, NetworkState,
};
use agama_lib::network::{
    settings::{self},
    types::DeviceType,
    NetworkClient,
};
use cidr::IpInet;
use std::error::Error;
use tokio::test;

#[derive(Default)]
pub struct NetworkTestAdapter(network::NetworkState);

impl Adapter for NetworkTestAdapter {
    fn read(&self) -> Result<network::NetworkState, Box<dyn std::error::Error>> {
        Ok(self.0.clone())
    }

    fn write(&self, _network: &network::NetworkState) -> Result<(), Box<dyn std::error::Error>> {
        unimplemented!("Not used in tests");
    }
}

#[test]
async fn test_read_connections() -> Result<(), Box<dyn Error>> {
    let mut server = DBusServer::new().start().await?;

    let device = model::Device {
        name: String::from("eth0"),
        type_: DeviceType::Ethernet,
    };
    let eth0 = model::Connection::new("eth0".to_string(), DeviceType::Ethernet);
    let state = NetworkState::new(vec![device], vec![eth0]);
    let adapter = NetworkTestAdapter(state);

    let _service = NetworkService::start(&server.connection(), adapter).await?;
    server.request_name().await?;

    let client = NetworkClient::new(server.connection()).await?;
    let conns = async_retry(|| client.connections()).await?;
    assert_eq!(conns.len(), 1);
    let dbus_eth0 = conns.first().unwrap();
    assert_eq!(dbus_eth0.id, "eth0");
    assert_eq!(dbus_eth0.device_type(), DeviceType::Ethernet);
    Ok(())
}

#[test]
async fn test_add_connection() -> Result<(), Box<dyn Error>> {
    let mut server = DBusServer::new().start().await?;

    let adapter = NetworkTestAdapter(NetworkState::default());

    let _service = NetworkService::start(&server.connection(), adapter).await?;
    server.request_name().await?;

    let client = NetworkClient::new(server.connection().clone()).await?;

    let addresses: Vec<IpInet> = vec!["192.168.0.2/24".parse()?, "::ffff:c0a8:7ac7/64".parse()?];
    let wlan0 = settings::NetworkConnection {
        id: "wlan0".to_string(),
        mac_address: Some("FD:CB:A9:87:65:43".to_string()),
        method4: Some("auto".to_string()),
        method6: Some("disabled".to_string()),
        addresses: addresses.clone(),
        wireless: Some(settings::WirelessSettings {
            password: "123456".to_string(),
            security: "wpa-psk".to_string(),
            ssid: "TEST".to_string(),
            mode: "infrastructure".to_string(),
        }),
        ..Default::default()
    };
    client.add_or_update_connection(&wlan0).await?;

    let conns = async_retry(|| client.connections()).await?;
    assert_eq!(conns.len(), 1);

    let conn = conns.first().unwrap();
    assert_eq!(conn.id, "wlan0");
    assert_eq!(conn.mac_address, Some("FD:CB:A9:87:65:43".to_string()));
    assert_eq!(conn.device_type(), DeviceType::Wireless);
    assert_eq!(&conn.addresses, &addresses);
    let method4 = conn.method4.as_ref().unwrap();
    assert_eq!(method4, &Ipv4Method::Auto.to_string());
    let method6 = conn.method6.as_ref().unwrap();
    assert_eq!(method6, &Ipv6Method::Disabled.to_string());

    Ok(())
}

#[test]
async fn test_add_bond_connection() -> Result<(), Box<dyn Error>> {
    let mut server = DBusServer::new().start().await?;

    let adapter = NetworkTestAdapter(NetworkState::default());

    let _service = NetworkService::start(&server.connection(), adapter).await?;
    server.request_name().await?;

    let client = NetworkClient::new(server.connection().clone()).await?;
    let bond0 = settings::NetworkConnection {
        id: "bond0".to_string(),
        method4: Some("auto".to_string()),
        method6: Some("disabled".to_string()),
        interface: Some("bond0".to_string()),
        bond: Some(settings::BondSettings {
            mode: "active-backup".to_string(),
            ports: vec!["eth0".to_string(), "eth1".to_string()],
            options: Some("primary=eth1".to_string()),
        }),
        ..Default::default()
    };

    client.add_or_update_connection(&bond0).await?;
    let conns = async_retry(|| client.connections()).await?;
    assert_eq!(conns.len(), 1);

    let conn = conns.iter().find(|c| c.id == "bond0".to_string()).unwrap();
    assert_eq!(conn.id, "bond0");
    assert_eq!(conn.device_type(), DeviceType::Bond);
    let bond = conn.bond.clone().unwrap();
    assert_eq!(bond.mode, "active-backup");

    Ok(())
}

#[test]
async fn test_update_connection() -> Result<(), Box<dyn Error>> {
    let mut server = DBusServer::new().start().await?;

    let device = model::Device {
        name: String::from("eth0"),
        type_: DeviceType::Ethernet,
    };
    let eth0 = model::Connection::new("eth0".to_string(), DeviceType::Ethernet);
    let state = NetworkState::new(vec![device], vec![eth0]);
    let adapter = NetworkTestAdapter(state);

    let _service = NetworkService::start(&server.connection(), adapter).await?;
    server.request_name().await?;

    let client = NetworkClient::new(server.connection()).await?;
    // make sure connections have been published.
    let _conns = async_retry(|| client.connections()).await?;

    let mut dbus_eth0 = async_retry(|| client.get_connection("eth0")).await?;
    dbus_eth0.interface = Some("eth0".to_string());
    client.add_or_update_connection(&dbus_eth0).await?;
    let dbus_eth0 = client.get_connection("eth0").await?;
    assert_eq!(dbus_eth0.interface, Some("eth0".to_string()));
    Ok(())
}
