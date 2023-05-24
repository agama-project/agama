use agama_lib::connection;
use agama_network::NetworkService;
use async_std;

#[async_std::main]
async fn main() {
    let connection = connection()
        .await
        .expect("Could not connect to the D-Bus server");

    NetworkService::start(connection)
        .await
        .expect("Could not start the service");

    loop {
        std::future::pending::<()>().await;
    }
}
