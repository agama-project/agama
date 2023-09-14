const DEFAULT_COMMANDS: [(&str, &str); 2] = [
    // (executable, {options})
	("journalctl", "-u agama"),
	("journalctl", "--dmesg")
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
	"/etc/os_release",
	"/linuxrc.config"
];

const DEFAULT_RESULT: &str = "/tmp/agama_logs";
const DEFAULT_NOISY: bool = true;

// A wrapper around println which shows (or not) output depending on noisy boolean variable
macro_rules! show
{
	($n:expr, $($arg:tt)*) => { if($n) { println!($($arg)*) } }
}

fn main() {
	// 0. preparation, e.g. later features some logs commands can be added / excluded per users request or
	let commands = DEFAULT_COMMANDS;
	let paths = DEFAULT_PATHS;
	let result = DEFAULT_RESULT;
	let noisy = DEFAULT_NOISY;

    show!(noisy, "Collecting Agama logs:");

	// 1. create temporary directory where to collect all files (similar to what old save_y2logs
	// does)

	// 2. collect existing / requested paths

	show!(noisy, "\t- proceeding well known paths:");
	for path in paths
	{
		show!(noisy, "\t\t- packing: \"{}\"", path);
	}

	// 3. some info can be collected via particular commands only

	show!(noisy, "\t- proceeding output of commands:");
	for cmd in commands
	{
		show!(noisy, "\t\t- packing output of: \"{} {}\"", cmd.0, cmd.1);
	}

	show!(true, "Storing result in: \"{}\"", result)
}
