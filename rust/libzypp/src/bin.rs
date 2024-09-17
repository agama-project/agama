use std::process::exit;

use glib::Error;
use libzypp::InfoBaseExt;

fn print_system() -> Result<(), Error> {
    println!("System repos:");
    print_with_root("/")?;
    println!("");
    Ok(())
}

fn print_host() -> Result<(), Error> {
    println!("Host repos:");
    print_with_root("/run/host")?;
    println!("");
    Ok(())
}

fn print_with_root(root: &str) -> Result<(), Error> {
    let context = libzypp::Context::builder().build();
    context.load_system(Some(root))?;

    let repo_manager = libzypp::RepoManager::new(&context);
    repo_manager.initialize()?;

    for repo in repo_manager.known_repos() {
        println!("{:?}", repo.name());
    }

    Ok(())
}

fn main() -> () {
    if let Err(err) = print_system() {
        println!("Failed to system: {}", err.to_string());
        exit(1);
    }

    if let Err(err) = print_host() {
        println!("Failed to system: {}", err.to_string());
        exit(1);
    }
}