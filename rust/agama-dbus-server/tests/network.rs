mod common;

use self::common::DBusServer;
use agama_dbus_server::network::{self, model, Adapter, NetworkService, NetworkState};
use agama_lib::{
    connection_to,
    network::{settings, types::DeviceType, NetworkClient},
};
use async_std::test;

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
async fn test_read_connections() {
    let server = DBusServer::start_server();

    let device = model::Device {
        name: String::from("eth0"),
        type_: DeviceType::Ethernet,
    };
    let eth0 = model::Connection::new("eth0".to_string(), DeviceType::Ethernet);
    let state = NetworkState::new(vec![device], vec![eth0]);
    let adapter = NetworkTestAdapter(state);

    // TODO: Find a better way to detect when the server started
    let ten_millis = std::time::Duration::from_millis(1000);
    std::thread::sleep(ten_millis);

    let _service = NetworkService::start(&server.address, adapter)
        .await
        .unwrap();

    let ten_millis = std::time::Duration::from_millis(1000);
    std::thread::sleep(ten_millis);

    let connection = connection_to(&server.address).await.unwrap();
    let client = NetworkClient::new(connection.clone()).await.unwrap();
    let conns = client.connections().await.unwrap();
    assert_eq!(conns.len(), 1);
    let dbus_eth0 = conns.first().unwrap();
    assert_eq!(dbus_eth0.id, "eth0");
    assert_eq!(dbus_eth0.device_type(), DeviceType::Ethernet);
}

#[test]
async fn test_add_connection() {
    let server = DBusServer::start_server();

    let state = NetworkState::default();
    let adapter = NetworkTestAdapter(state);

    // TODO: Find a better way to detect when the server started
    let ten_millis = std::time::Duration::from_millis(100);
    std::thread::sleep(ten_millis);

    let _service = NetworkService::start(&server.address, adapter)
        .await
        .unwrap();

    let ten_millis = std::time::Duration::from_millis(1000);
    std::thread::sleep(ten_millis);

    let connection = connection_to(&server.address).await.unwrap();
    let client = NetworkClient::new(connection.clone()).await.unwrap();

    let wlan0 = settings::NetworkConnection {
        id: "wlan0".to_string(),
        method: Some("auto".to_string()),
        wireless: Some(settings::WirelessSettings {
            password: "123456".to_string(),
            security: "wpa-psk".to_string(),
            ssid: "TEST".to_string(),
            mode: "infrastructure".to_string(),
        }),
        ..Default::default()
    };
    client.add_or_update_connection(&wlan0).await.unwrap();

    let conns = client.connections().await.unwrap();
    assert_eq!(conns.len(), 1);
    let conn = conns.first().unwrap();
    assert_eq!(conn.id, "wlan0");
    assert_eq!(conn.device_type(), DeviceType::Wireless);
}
