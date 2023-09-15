extern crate tempdir;

use tempdir::TempDir;
use std::io;
use std::fs;
use std::path::Path;
use std::process::Command;

const DEFAULT_COMMANDS: [(&str, &str); 2] = [
    // (executable, {options})
	("journalctl", "-u agama"),
	("journalctl", "--dmesg")
];

const DEFAULT_PATHS: [&str; 14] = [
    // logs
	"/var/log/YaST2",
	"/tmp/var/log/zypper.log",
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
	"/etc/os_release",
	"/linuxrc.config"
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
//
// A wrapper around println which shows (or not) output depending on noisy boolean variable
macro_rules! show
{
	($n:expr, $($arg:tt)*) => { if($n) { print!($($arg)*) } }
}

fn main() -> Result<(), io::Error>{
	// 0. preparation, e.g. later features some logs commands can be added / excluded per users request or
	let commands = DEFAULT_COMMANDS;
	let paths = DEFAULT_PATHS;
	let result = format!("{}.{}", DEFAULT_RESULT, DEFAULT_COMPRESSION.1);
	let noisy = DEFAULT_NOISY;
	let compression = DEFAULT_COMPRESSION.0;

    showln!(noisy, "Collecting Agama logs:");

	// 1. create temporary directory where to collect all files (similar to what old save_y2logs
	// does)
	let tmp_dir = TempDir::new(DEFAULT_TMP_DIR)?;
	let compress_cmd = format!("tar -c -f {} --warning=no-file-changed --{} --dereference -C {} .", result, compression, tmp_dir.path().display());

	// 2. collect existing / requested paths

	showln!(noisy, "\t- proceeding well known paths:");
	for path in paths
	{
		show!(noisy, "\t\t- storing: \"{}\" ... ", path);
		// assumption: path is full path
		if Path::new(path).try_exists().is_ok()
		{
			let r_path = Path::new(path).strip_prefix("/").unwrap();
			let dir_path = Path::new(r_path).parent().unwrap();

			fs::create_dir_all(tmp_dir.path().join(dir_path));
			let res = if fs::copy(path, tmp_dir.path().join(r_path)).is_ok() { "[Ok]" } else { "[Failed]" };

			showln!(noisy, "{}", res);
		}
	}

	// 3. some info can be collected via particular commands only

	showln!(noisy, "\t- proceeding output of commands:");
	for cmd in commands
	{
		showln!(noisy, "\t\t- packing output of: \"{} {}\"", cmd.0, cmd.1);
	}

	// 4. store it
	showln!(true, "Storing result in: \"{}\"", result);

	let cmd_parts = compress_cmd.split_whitespace().collect::<Vec<&str>>();

	print!("{} ", cmd_parts[0]);
	for arg in cmd_parts[1..].iter()
	{
		print!("{} ", arg);
	}
	println!("");

	Command::new(cmd_parts[0])
		.args(cmd_parts[1..].iter())
		.status()
		.expect("failed crating the archive");

	Ok(())
}
