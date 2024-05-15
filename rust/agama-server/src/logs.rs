use log::{self, LevelFilter, SetLoggerError};

pub fn start_logging() -> Result<(), SetLoggerError> {
    if systemd_journal_logger::connected_to_journal() {
        // unwrap here is intentional as we are sure no other logger is active yet
        systemd_journal_logger::JournalLog::default().install()?;
        log::set_max_level(LevelFilter::Info); // log only info for journal logger
    } else {
        simplelog::TermLogger::init(
            LevelFilter::Info, // lets use info, trace provides too much output from libraries
            simplelog::Config::default(),
            simplelog::TerminalMode::Stderr, // only stderr output for easier filtering
            simplelog::ColorChoice::Auto,
        )?;
    }
    Ok(())
}
