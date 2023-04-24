mod dbus;
mod service;
mod state;

use agama_lib::connection;
use async_std;
use service::NetworkService;
use state::NetworkState;

#[async_std::main]
async fn main() {
    let state = NetworkState::from_system().expect("Could not retrieve the network state");

    let connection = connection()
        .await
        .expect("Could not connect to the D-Bus server");
    let service = NetworkService::new(state, connection);

    service.listen().await.expect("Could not start listening");

    loop {
        std::future::pending::<()>().await;
    }
}
