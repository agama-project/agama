use agama_lib::{
    connection,
    network::{NetworkService, NetworkState},
};
use async_std;

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
