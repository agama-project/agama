use agama_lib::connection;
use agama_network::{NetworkService, NetworkSystem};
use async_std;

#[async_std::main]
async fn main() {
    let network = NetworkSystem::from_network_manager()
        .await
        .expect("Could not read network state");

    let connection = connection()
        .await
        .expect("Could not connect to the D-Bus server");

    let mut service = NetworkService::new(network, connection);
    service.listen().await.expect("Could not start the service");

    loop {
        std::future::pending::<()>().await;
    }
}
