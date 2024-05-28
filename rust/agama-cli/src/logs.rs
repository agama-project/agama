use clap::Subcommand;
use fs_extra::copy_items;
use fs_extra::dir::CopyOptions;
use nix::unistd::Uid;
use std::fs;
use std::fs::File;
use std::io;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;

// definition of "agama logs" subcommands, see clap crate for details
#[derive(Subcommand, Debug)]
pub enum LogsCommands {
    /// Collect and store the logs in a tar archive.
    Store {
        #[clap(long, short = 'v')]
        /// Verbose output
        verbose: bool,
        #[clap(long, short = 'd')]
        /// Path to destination directory and, optionally, the archive file name. The extension will
        /// be added automatically.
        destination: Option<PathBuf>,
    },
    /// List the logs to collect
    List,
}

/// Main entry point called from agama CLI main loop
pub async fn run(subcommand: LogsCommands) -> anyhow::Result<()> {
    match subcommand {
        LogsCommands::Store {
            verbose,
            destination,
        } => {
            // feed internal options structure by what was received from user
            // for now we always use / add defaults if any
            let destination = parse_destination(destination)?;
            let options = LogOptions {
                verbose,
                destination,
                ..Default::default()
            };

            Ok(store(options)?)
        }
        LogsCommands::List => {
            list(LogOptions::default());

            Ok(())
        }
    }
}

/// Whatewer passed in destination formed into an absolute path with archive name
///
/// # Arguments:
/// * destination
///     - if None then a default is returned
///     - if a path to a directory then a default file name for the archive will be appended to the
///     path
///     - if path with a file name then it is used as is for resulting archive, just extension will
///     be appended later on (depends on used compression)
fn parse_destination(destination: Option<PathBuf>) -> Result<PathBuf, io::Error> {
    let err = io::Error::new(io::ErrorKind::InvalidInput, "Invalid destination path");
    let mut buffer = destination.unwrap_or(PathBuf::from(DEFAULT_RESULT));
    let path = buffer.as_path();

    // existing directory -> append an archive name
    if path.is_dir() {
        buffer.push("agama-logs");
    // a path with file name
    // sadly, is_some_and is unstable
    } else if path.parent().is_some() {
        // validate if parent directory realy exists
        if !path.parent().unwrap().is_dir() {
            return Err(err);
        }
    }

    // buffer is <directory> or <directory>/<file_name> here
    // and we know that directory tree which leads to the <file_name> is valid.
    // <file_name> creation can still fail later on.
    Ok(buffer)
}

const DEFAULT_COMMANDS: [(&str, &str); 3] = [
    // (<command to be executed>, <file name used for storing result of the command>)
    ("journalctl -u agama", "agama"),
    ("journalctl -u agama-auto", "agama-auto"),
    ("journalctl --dmesg", "dmesg"),
];

const DEFAULT_PATHS: [&str; 14] = [
    // logs
    "/var/log/YaST2",
    "/var/log/zypper.log",
    "/var/log/zypper/history*",
    "/var/log/zypper/pk_backend_zypp",
    "/var/log/pbl.log",
    "/var/log/linuxrc.log",
    "/var/log/wickedd.log",
    "/var/log/NetworkManager",
    "/var/log/messages",
    "/var/log/boot.msg",
    "/var/log/udev.log",
    // config
    "/etc/install.inf",
    "/etc/os-release",
    "/linuxrc.config",
];

const DEFAULT_RESULT: &str = "/tmp/agama-logs";
// what compression is used by default:
// (<compression as distinguished by tar>, <an extension for resulting archive>)
const DEFAULT_COMPRESSION: (&str, &str) = ("bzip2", "tar.bz2");
const TMP_DIR_PREFIX: &str = "agama-logs.";

/// A wrapper around println which shows (or not) the text depending on the boolean variable
fn showln(show: bool, text: &str) {
    if !show {
        return;
    }

    println!("{}", text);
}

/// A wrapper around println which shows (or not) the text depending on the boolean variable
fn show(show: bool, text: &str) {
    if !show {
        return;
    }

    print!("{}", text);
}

/// Configurable parameters of the "agama logs" which can be
/// set by user when calling a (sub)command
struct LogOptions {
    paths: Vec<String>,
    commands: Vec<(String, String)>,
    verbose: bool,
    destination: PathBuf,
}

impl Default for LogOptions {
    fn default() -> Self {
        Self {
            paths: DEFAULT_PATHS.iter().map(|p| p.to_string()).collect(),
            commands: DEFAULT_COMMANDS
                .iter()
                .map(|(cmd, name)| (cmd.to_string(), name.to_string()))
                .collect(),
            verbose: false,
            destination: PathBuf::from(DEFAULT_RESULT),
        }
    }
}

/// Struct for log represented by a file
struct LogPath {
    // log source
    src_path: String,

    // directory where to collect logs
    dst_path: PathBuf,
}

impl LogPath {
    fn new(src: &str, dst: &Path) -> Self {
        Self {
            src_path: src.to_string(),
            dst_path: dst.to_owned(),
        }
    }
}

/// Struct for log created on demand by a command
struct LogCmd {
    // command which stdout / stderr is logged
    cmd: String,

    // user defined log file name (if any)
    file_name: String,

    // place where to collect logs
    dst_path: PathBuf,
}

impl LogCmd {
    fn new(cmd: &str, file_name: &str, dst: &Path) -> Self {
        Self {
            cmd: cmd.to_string(),
            file_name: file_name.to_string(),
            dst_path: dst.to_owned(),
        }
    }
}

trait LogItem {
    // definition of log source
    fn from(&self) -> &String;

    // definition of destination as path to a file
    fn to(&self) -> PathBuf;

    // performs whatever is needed to store logs from "from" at "to" path
    fn store(&self) -> Result<(), io::Error>;
}

impl LogItem for LogPath {
    fn from(&self) -> &String {
        &self.src_path
    }

    fn to(&self) -> PathBuf {
        // remove leading '/' if any from the path (reason see later)
        let r_path = Path::new(self.src_path.as_str()).strip_prefix("/").unwrap();

        // here is the reason, join overwrites the content if the joined path is absolute
        self.dst_path.join(r_path)
    }

    fn store(&self) -> Result<(), io::Error> {
        let dst_file = self.to();
        let dst_path = dst_file.parent().unwrap();

        // for now keep directory structure close to the original
        // e.g. what was in /etc will be in /<tmp dir>/etc/
        fs::create_dir_all(dst_path)?;

        let options = CopyOptions::new();
        // fs_extra's own Error doesn't implement From trait so ? operator is unusable
        match copy_items(&[self.src_path.as_str()], dst_path, &options) {
            Ok(_p) => Ok(()),
            Err(_e) => Err(io::Error::new(
                io::ErrorKind::Other,
                "Copying of a file failed",
            )),
        }
    }
}

impl LogItem for LogCmd {
    fn from(&self) -> &String {
        &self.cmd
    }

    fn to(&self) -> PathBuf {
        let mut file_name;

        if self.file_name.is_empty() {
            file_name = self.cmd.clone();
        } else {
            file_name = self.file_name.clone();
        };

        file_name.retain(|c| c != ' ');
        self.dst_path.as_path().join(&file_name)
    }

    fn store(&self) -> Result<(), io::Error> {
        let cmd_parts = self.cmd.split_whitespace().collect::<Vec<&str>>();
        let file_path = self.to();
        let output = Command::new(cmd_parts[0])
            .args(cmd_parts[1..].iter())
            .output()?;
        let mut file_stdout = File::create(format!("{}.out.log", file_path.display()))?;
        let mut file_stderr = File::create(format!("{}.err.log", file_path.display()))?;

        file_stdout.write_all(&output.stdout)?;
        file_stderr.write_all(&output.stderr)?;

        Ok(())
    }
}

/// Collect existing / requested paths which should already exist in the system.
/// Turns them into list of log sources
fn paths_to_log_sources(paths: &[String], tmp_dir: &TempDir) -> Vec<Box<dyn LogItem>> {
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    for path in paths.iter() {
        // assumption: path is full path
        if Path::new(path).try_exists().is_ok() {
            log_sources.push(Box::new(LogPath::new(path.as_str(), tmp_dir.path())));
        }
    }

    log_sources
}

/// Some info can be collected via particular commands only, turn it into log sources
fn cmds_to_log_sources(commands: &[(String, String)], tmp_dir: &TempDir) -> Vec<Box<dyn LogItem>> {
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    for cmd in commands.iter() {
        log_sources.push(Box::new(LogCmd::new(
            cmd.0.as_str(),
            cmd.1.as_str(),
            tmp_dir.path(),
        )));
    }

    log_sources
}

/// Compress given directory into a tar archive
fn compress_logs(tmp_dir: &TempDir, result: &String) -> io::Result<()> {
    let compression = DEFAULT_COMPRESSION.0;
    let tmp_path = tmp_dir
        .path()
        .parent()
        .and_then(|p| p.as_os_str().to_str())
        .ok_or(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Malformed path to temporary directory",
        ))?;
    let dir = tmp_dir
        .path()
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Malformed path to temporary director",
        ))?;
    let compress_cmd = format!(
        "tar -c -f {} --warning=no-file-changed --{} --dereference -C {} {}",
        result, compression, tmp_path, dir,
    );
    let cmd_parts = compress_cmd.split_whitespace().collect::<Vec<&str>>();
    let res = Command::new(cmd_parts[0])
        .args(cmd_parts[1..].iter())
        .status()?;

    if res.success() {
        set_archive_permissions(result)
    } else {
        Err(io::Error::new(
            io::ErrorKind::Other,
            "Cannot create tar archive",
        ))
    }
}

/// Sets the archive owner to root:root. Also sets the file permissions to read/write for the
/// owner only.
fn set_archive_permissions(archive: &String) -> io::Result<()> {
    let attr = fs::metadata(archive)?;
    let mut permissions = attr.permissions();

    // set the archive file permissions to -rw-------
    permissions.set_mode(0o600);
    fs::set_permissions(archive, permissions)?;

    // set the archive owner to root:root
    // note: std::os::unix::fs::chown is unstable for now
    Command::new("chown")
        .args(["root:root", archive.as_str()])
        .status()?;

    Ok(())
}

/// Handler for the "agama logs store" subcommand
fn store(options: LogOptions) -> Result<(), io::Error> {
    if !Uid::effective().is_root() {
        panic!("No Root, no logs. Sorry.");
    }

    // preparation, e.g. in later features some log commands can be added / excluded per users request or
    let commands = options.commands;
    let paths = options.paths;
    let verbose = options.verbose;
    let opt_dest = options.destination.into_os_string();
    let destination = opt_dest.to_str().ok_or(io::Error::new(
        io::ErrorKind::InvalidInput,
        "Malformed destination path",
    ))?;
    let result = format!("{}.{}", destination, DEFAULT_COMPRESSION.1);

    showln(verbose, "Collecting Agama logs:");

    // create temporary directory where to collect all files (similar to what old save_y2logs
    // does)
    let tmp_dir = TempDir::with_prefix(TMP_DIR_PREFIX)?;
    let mut log_sources = paths_to_log_sources(&paths, &tmp_dir);

    showln(verbose, "\t- proceeding well known paths");
    log_sources.append(&mut cmds_to_log_sources(&commands, &tmp_dir));

    // some info can be collected via particular commands only
    showln(verbose, "\t- proceeding output of commands");

    // store it
    if verbose {
        showln(true, format!("Storing result in: \"{}\"", result).as_str());
    } else {
        showln(true, result.as_str());
    }

    for log in log_sources.iter() {
        show(
            verbose,
            format!("\t- storing: \"{}\" ... ", log.from()).as_str(),
        );

        // for now keep directory structure close to the original
        // e.g. what was in /etc will be in /<tmp dir>/etc/
        let res = match fs::create_dir_all(log.to().parent().unwrap()) {
            Ok(_p) => match log.store() {
                Ok(_p) => "[Ok]",
                Err(_e) => "[Failed]",
            },
            Err(_e) => "[Failed]",
        };

        showln(verbose, res.to_string().as_str());
    }

    compress_logs(&tmp_dir, &result)
}

/// Handler for the "agama logs list" subcommand
fn list(options: LogOptions) {
    for list in [
        ("Log paths: ", options.paths),
        (
            "Log commands: ",
            options.commands.iter().map(|c| c.0.clone()).collect(),
        ),
    ] {
        println!("{}", list.0);

        for item in list.1.iter() {
            println!("\t{}", item);
        }

        println!();
    }
}
