pub mod error;
pub mod locale;

use std::future::pending;

#[async_std::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _con = crate::locale::Locale::start_service().await?;

    // Do other things or go to wait forever
    pending::<()>().await;

    Ok(())
}
