use agama_lib::{
    connection,
    network::{NetworkService, NetworkState},
};
use async_std;
use env_logger;
use log::{debug, info};

#[async_std::main]
async fn main() {
    let state = NetworkState::from_system().expect("Could not retrieve the network state");

    let connection = connection()
        .await
        .expect("Could not connect to the D-Bus server");
    let service = NetworkService::new(state, connection);

    service.listen().await.expect("Could not start listening");

    env_logger::init();
    info!("Agama network service started");

    loop {
        std::future::pending::<()>().await;
    }
}
