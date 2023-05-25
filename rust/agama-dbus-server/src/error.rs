use zbus_macros::DBusError;

#[derive(DBusError, Debug)]
#[dbus_error(prefix = "org.opensuse.Agama.Locale1")]
pub enum Error {
    #[dbus_error(zbus_error)]
    ZBus(zbus::Error),
    Anyhow(String),
}

// This would be nice, but using it for a return type
// results in a confusing error message about
// error[E0277]: the trait bound `MyError: Serialize` is not satisfied
//type MyResult<T> = Result<T, MyError>;

impl From<anyhow::Error> for Error {
    fn from(e: anyhow::Error) -> Self {
        // {:#} includes causes
        Self::Anyhow(format!("{:#}", e))
    }
}
