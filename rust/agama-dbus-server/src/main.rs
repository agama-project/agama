pub mod error;
pub mod locale;

use std::future::pending;

use zbus::ConnectionBuilder;

// Although we use `async-std` here, you can use any async runtime of choice.
#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let locale = crate::locale::Locale::new();
    let _conn = ConnectionBuilder::session()? //TODO: use agama bus instead of session one
        .name("org.opensuse.Agama.Locale1")?
        .serve_at("/org/opensuse/Agama/Locale1", locale)?
        .build()
        .await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
