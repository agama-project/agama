pub mod error;
pub mod locale;

use std::future::pending;

// Although we use `async-std` here, you can use any async runtime of choice.
#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    crate::locale::Locale::start_service().await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
