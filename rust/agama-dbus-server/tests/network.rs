mod common;

use self::common::DBusServer;
use agama_dbus_server::network::{self, model, Adapter, NetworkService, NetworkState};
use agama_lib::network::{settings, types::DeviceType, NetworkClient};
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
    let mut server = DBusServer::new().start().await;

    let device = model::Device {
        name: String::from("eth0"),
        type_: DeviceType::Ethernet,
    };
    let eth0 = model::Connection::new("eth0".to_string(), DeviceType::Ethernet);
    let state = NetworkState::new(vec![device], vec![eth0]);
    let adapter = NetworkTestAdapter(state);

    let _service = NetworkService::start(&server.connection(), adapter)
        .await
        .unwrap();

    server.request_name().await.unwrap();

    let client = NetworkClient::new(server.connection()).await.unwrap();
    let conns = client.connections().await.unwrap();
    assert_eq!(conns.len(), 1);
    let dbus_eth0 = conns.first().unwrap();
    assert_eq!(dbus_eth0.id, "eth0");
    assert_eq!(dbus_eth0.device_type(), DeviceType::Ethernet);
}

#[test]
async fn test_add_connection() {
    let mut server = DBusServer::new().start().await;

    let adapter = NetworkTestAdapter(NetworkState::default());

    let _service = NetworkService::start(&server.connection(), adapter)
        .await
        .unwrap();
    server.request_name().await.unwrap();

    let client = NetworkClient::new(server.connection().clone())
        .await
        .unwrap();

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
