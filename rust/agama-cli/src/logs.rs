use clap::Subcommand;
use fs_extra::copy_items;
use fs_extra::dir::CopyOptions;
use nix::unistd::Uid;
use std::fs;
use std::fs::File;
use std::io;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempdir::TempDir;

// definition of "agama logs" subcommands, see clap crate for details
#[derive(Subcommand, Debug)]
pub enum LogsCommands {
    /// Collects and stores logs in a tar archive
    Store {
        #[clap(long, short = 'v')]
        /// Verbose output
        verbose: bool,
    },
    /// List logs which will be collected
    List,
}

// main entry point called from agama CLI main loop
pub async fn run(subcommand: LogsCommands) -> anyhow::Result<()> {
    match subcommand {
        LogsCommands::Store { verbose } => {
            // feed internal options structure by what was received from user
            // for now we always use / add defaults if any
            let mut options = LogOptions::new();

            options.verbose = verbose;

            Ok(store(options)?)
        },
        LogsCommands::List => {
            let options = LogOptions::new();

            list(options);

            Ok(())
        },
    }
}

const DEFAULT_COMMANDS: [&str; 3] = [
    "journalctl -u agama",
    "journalctl -u agama-auto",
    "journalctl --dmesg",
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

const DEFAULT_RESULT: &str = "/tmp/agama_logs";
const DEFAULT_COMPRESSION: (&str, &str) = ("bzip2", "tar.bz2");
const DEFAULT_TMP_DIR: &str = "agama-logs";

// A wrapper around println which shows (or not) the text depending on the boolean variable
fn showln(show: bool, text: &str) {
    if !show {
        return;
    }

    println!("{}", text);
}

// A wrapper around println which shows (or not) the text depending on the boolean variable
fn show(show: bool, text: &str) {
    if !show {
        return;
    }

    print!("{}", text);
}

// Configurable parameters of the "agama logs" which can be
// set by user when calling a (sub)command
struct LogOptions {
    paths: Vec<String>,
    commands: Vec<String>,
    verbose: bool,
}

impl LogOptions {
    fn new() -> Self {
        Self {
            paths: DEFAULT_PATHS.iter().map(|p| p.to_string()).collect(),
            commands: DEFAULT_COMMANDS.iter().map(|p| p.to_string()).collect(),
            verbose: false,
        }
    }
}

// Struct for log represented by a file
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

// Struct for log created on demand by a command
struct LogCmd {
    // command which stdout / stderr is logged
    cmd: String,

    // place where to collect logs
    dst_path: PathBuf,
}

impl LogCmd {
    fn new(cmd: &str, dst: &Path) -> Self {
        Self {
            cmd: cmd.to_string(),
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
        self.dst_path.as_path().join(format!("{}", self.cmd))
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

// Collect existing / requested paths which should already exist in the system.
// Turns them into list of log sources
fn paths_to_log_sources(paths: &Vec<String>, tmp_dir: &TempDir) -> Vec<Box<dyn LogItem>> {
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    for path in paths.iter() {
        // assumption: path is full path
        if Path::new(path).try_exists().is_ok() {
            log_sources.push(Box::new(LogPath::new(path.as_str(), tmp_dir.path())));
        }
    }

    log_sources
}

// Some info can be collected via particular commands only, turn it into log sources
fn cmds_to_log_sources(commands: &Vec<String>, tmp_dir: &TempDir) -> Vec<Box<dyn LogItem>> {
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    for cmd in commands.iter() {
        log_sources.push(Box::new(LogCmd::new(cmd.as_str(), tmp_dir.path())));
    }

    log_sources
}

// Compress given directory into a tar archive
fn compress_logs(tmp_dir: &TempDir, result: &String) -> io::Result<()> {
    let compression = DEFAULT_COMPRESSION.0;
    let compress_cmd = format!(
        "tar -c -f {} --warning=no-file-changed --{} --dereference -C {} .",
        result,
        compression,
        tmp_dir.path().display()
    );
    let cmd_parts = compress_cmd.split_whitespace().collect::<Vec<&str>>();

    match Command::new(cmd_parts[0])
        .args(cmd_parts[1..].iter())
        .status()
    {
        Ok(_o) => Ok(()),
        Err(_e) => Err(io::Error::new(
            io::ErrorKind::Other,
            "Cannot create tar archive",
        )),
    }
}

// Handler for the "agama logs store" subcommand
fn store(options: LogOptions) -> Result<(), io::Error> {
    if !Uid::effective().is_root() {
        panic!("No Root, no logs. Sorry.");
    }

    // preparation, e.g. in later features some log commands can be added / excluded per users request or
    let commands = options.commands;
    let paths = options.paths;
    let verbose = options.verbose;
    let result = format!("{}.{}", DEFAULT_RESULT, DEFAULT_COMPRESSION.1);

    showln(verbose, "Collecting Agama logs:");

    // create temporary directory where to collect all files (similar to what old save_y2logs
    // does)
    let tmp_dir = TempDir::new(DEFAULT_TMP_DIR)?;
    let mut log_sources = paths_to_log_sources(&paths, &tmp_dir);

    showln(verbose, "\t- proceeding well known paths");
    log_sources.append(&mut cmds_to_log_sources(&commands, &tmp_dir));

    // some info can be collected via particular commands only
    showln(verbose, "\t- proceeding output of commands");

    // store it
    showln(true, format!("Storing result in: \"{}\"", result).as_str());

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

        showln(verbose, format!("{}", res).as_str());
    }

    compress_logs(&tmp_dir, &result)
}

// Handler for the "agama logs list" subcommand
fn list(options: LogOptions)
{
    for list in [options.paths, options.commands] {
        for item in list.iter() {
            println!("{}", item);
        }

        println!();
    }
}
