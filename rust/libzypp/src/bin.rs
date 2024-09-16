use std::process::exit;

use libzypp::InfoBaseExt;

fn main() -> () {
    let zcontext = libzypp::Context::builder().build();
    if let Err(err) = zcontext.load_system(Some("/")) {
        println!("Failed to load system: {}", err.to_string());
        exit(1);
    }

    let repo_manager = libzypp::RepoManager::new(&zcontext);
    if let Err(err) = repo_manager.initialize() {
        println!("Failed to load repos: {}", err.to_string());
        exit(1);
    }

    for repo in repo_manager.known_repos() {
        println!("{:?}", repo.name());
    }
}