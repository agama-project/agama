extern crate fs_extra;
extern crate tempdir;

use fs_extra::copy_items;
use fs_extra::dir::CopyOptions;
use nix::unistd::Uid;
use std::fs;
use std::fs::File;
use std::io;
use std::io::Error;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempdir::TempDir;

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
const DEFAULT_NOISY: bool = true;
const DEFAULT_COMPRESSION: (&str, &str) = ("bzip2", "tar.bz2");
const DEFAULT_TMP_DIR: &str = "agama-logs";

// A wrapper around println which shows (or not) output depending on noisy boolean variable
macro_rules! showln
{
    ($n:expr, $($arg:tt)*) => { if($n) { println!($($arg)*) } }
}

// A wrapper around println which shows (or not) output depending on noisy boolean variable
macro_rules! show
{
    ($n:expr, $($arg:tt)*) => { if($n) { print!($($arg)*) } }
}

// Struct for log represented by a file
struct LogPath {
    // log source
    src_path: String,

    // directory where to collect logs
    dst_path: PathBuf,
}

// Struct for log created on demmand by a command
struct LogCmd {
    // command which stdout / stderr is logged
    cmd: String,

    // place where to collect logs
    dst_path: PathBuf,
}

trait LogItem {
    // definition of log source
    fn from(&self) -> &String;

    // definition of destination as path to a file
    fn to(&self) -> PathBuf;

    // performs whatever is needed to store logs from "from" at "to" path
    fn store(&self) -> Result<(), Error>;
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

    fn store(&self) -> Result<(), Error> {
        // for now keep directory structure close to the original
        // e.g. what was in /etc will be in /<tmp dir>/etc/
        fs::create_dir_all(self.to().parent().unwrap())?;

        let options = CopyOptions::new();
        // fs_extra's own Error doesn't implement From trait so ? operator is unusable
        match copy_items(&[self.src_path.as_str()], self.to().parent().unwrap(), &options) {
            Ok(_p) => Ok(()),
            Err(_e) => Err(io::Error::new(io::ErrorKind::Other, "Copying of a file failed"))
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

    fn store(&self) -> Result<(), Error> {
        let cmd_parts = self.cmd.split_whitespace().collect::<Vec<&str>>();
        let file_path = self.to();
        let output = Command::new(cmd_parts[0])
            .args(cmd_parts[1..].iter())
            .output()
            .expect("Failed to run the command");
        let mut file_stdout = File::create(format!("{}.out.log", file_path.display()))?;
        let mut file_stderr = File::create(format!("{}.err.log", file_path.display()))?;

        file_stdout.write_all(&output.stdout)?;
        file_stderr.write_all(&output.stderr)?;

        Ok(())
    }
}

fn main() -> Result<(), io::Error> {
    if !Uid::effective().is_root() {
        panic!("No Root, no logs. Sorry.");
    }

    // 0. preparation, e.g. in later features some log commands can be added / excluded per users request or
    let commands = DEFAULT_COMMANDS;
    let paths = DEFAULT_PATHS;
    let result = format!("{}.{}", DEFAULT_RESULT, DEFAULT_COMPRESSION.1);
    let noisy = DEFAULT_NOISY;
    let compression = DEFAULT_COMPRESSION.0;
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    showln!(noisy, "Collecting Agama logs:");

    // 1. create temporary directory where to collect all files (similar to what old save_y2logs
    // does)
    let tmp_dir = TempDir::new(DEFAULT_TMP_DIR)?;

    // 2. collect existing / requested paths which should already exist
    showln!(noisy, "\t- proceeding well known paths");
    for path in paths {
        // assumption: path is full path
        if Path::new(path).try_exists().is_ok() {
            log_sources.push(Box::new(LogPath {
                src_path: path.to_string(),
                dst_path: tmp_dir.path().to_path_buf(),
            }));
        }
    }

    // 3. some info can be collected via particular commands only
    showln!(noisy, "\t- proceeding output of commands");
    for cmd in commands {
        log_sources.push(Box::new(LogCmd {
            cmd: cmd.to_string(),
            dst_path: tmp_dir.path().to_path_buf(),
        }));
    }

    // 4. store it
    showln!(true, "Storing result in: \"{}\"", result);

    for src in log_sources.iter() {
        let mut res = "[Failed]";

        show!(noisy, "\t- storing: \"{}\" ... ", src.from());

        // for now keep directory structure close to the original
        // e.g. what was in /etc will be in /<tmp dir>/etc/
        if fs::create_dir_all(src.to().parent().unwrap()).is_ok() {
            res = match src.store() {
                Ok(_p) => "[Ok]",
                Err(_e) => "[Failed]"
            }
        }

        showln!(noisy, "{}", res);
    }

    let compress_cmd = format!(
        "tar -c -f {} --warning=no-file-changed --{} --dereference -C {} .",
        result,
        compression,
        tmp_dir.path().display()
    );
    let cmd_parts = compress_cmd.split_whitespace().collect::<Vec<&str>>();

    Command::new(cmd_parts[0])
        .args(cmd_parts[1..].iter())
        .status()
        .expect("failed creating the archive");

    Ok(())
}
