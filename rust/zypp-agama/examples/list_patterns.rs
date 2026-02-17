use std::fs;

pub fn main() {
    let _ = fs::remove_dir_all("/tmp/zypp");
    fs::create_dir_all("/tmp/zypp").unwrap();
    let zypp = zypp_agama::Zypp::init_target(
        "/tmp/zypp",
        zypp_agama::callbacks::empty_init_target_progress,
    )
    .unwrap();

    const GPG_KEYS: &str = "/usr/lib/rpm/gnupg/keys/gpg-*";
    for file in glob::glob(GPG_KEYS).unwrap() {
        match file {
            Ok(file) => {
                if let Err(e) = zypp.import_gpg_key(&file.to_string_lossy()) {
                    tracing::error!("Failed to import GPG key: {}", e);
                }
            }
            Err(e) => {
                tracing::error!("Could not read GPG key file: {}", e);
            }
        }
    }

    zypp.add_repository(
        "tw",
        "https://download.opensuse.org/tumbleweed/repo/oss/",
        |_, _| true,
    )
    .unwrap();
    zypp.refresh_repository(
        "tw",
        &zypp_agama::callbacks::download_progress::EmptyCallback,
        &mut zypp_agama::callbacks::security::EmptyCallback,
    )
    .unwrap();
    zypp.load_source(
        zypp_agama::callbacks::empty_progress,
        &mut zypp_agama::callbacks::security::EmptyCallback,
    )
    .unwrap();
    zypp.create_repo_cache("tw", zypp_agama::callbacks::empty_progress)
        .unwrap();
    zypp.load_repo_cache("tw").unwrap();
    println!("TW patterns:");
    println!("{:?}", zypp.list_patterns().unwrap());
}
