use std::{fs, os::unix::fs::OpenOptionsExt, path::PathBuf};

use agama_transfer::Transfer;

pub fn download_file(url: &str, path: &PathBuf) {
    let mut file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
        .unwrap();
    // .context(format!("Cannot write the file '{}'", path.display()))?;

    match Transfer::get(url, &mut file) {
        Ok(()) => println!("File saved to {}", path.display()),
        Err(e) => eprintln!("Could not retrieve the file: {e}"),
    }
    // Ok(())
}

fn main() {
    let url = std::env::args().nth(1).unwrap();
    let path = std::env::args().nth(2).unwrap();
    let path = PathBuf::from(path);
    dbg!(&url);
    dbg!(&path);
    download_file(url.as_str(), &path);
}
