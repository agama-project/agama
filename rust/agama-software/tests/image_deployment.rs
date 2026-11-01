// Copyright (c) [2026] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use std::{path::PathBuf, sync::Arc};

use agama_security as security;
use agama_software::{message, ImageModel, Service};
use agama_utils::{
    actor::Handler,
    api::{
        event::Event,
        software::{Config, ImageConfig, ImageType, SoftwareConfig},
    },
    issue,
    products::{ProductSpec, ProductTemplate},
    progress, question,
};
use tempfile::TempDir;
use tokio::sync::{
    broadcast::{channel, Receiver},
    RwLock,
};

async fn start_test_software_service() -> (Handler<Service>, Receiver<Event>) {
    let (tx, rx) = channel(16);
    let issues = issue::Service::starter(tx.clone()).start();
    let l10n = agama_l10n::Service::starter(tx.clone(), issues.clone())
        .start()
        .await
        .expect("Failed to start l10n service");
    let questions = question::start(tx.clone()).await.unwrap();
    let progress = progress::Service::starter(tx.clone()).start();
    let security = security::test_utils::start_service(questions.clone()).await;

    let service = Service::starter(tx, issues, l10n, progress, questions, security)
        .start()
        .await
        .expect("Failed to start software service");

    (service, rx)
}

fn create_test_product() -> Arc<RwLock<ProductSpec>> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../test/share/products.d/tumbleweed.yaml");
    let template = std::fs::read_to_string(&path).unwrap();
    let template: ProductTemplate = serde_yaml::from_str(&template).unwrap();
    Arc::new(RwLock::new(template.to_product_spec(None).unwrap()))
}

#[tokio::test]
async fn test_service_image_deployment_configuration() {
    let (service, _events_rx) = start_test_software_service().await;
    let product = create_test_product();

    let image = ImageConfig::new("/images/tumbleweed.tar.xz", ImageType::Tarball)
        .with_recommended_hardware_packages(true);

    let config = Config {
        software: Some(SoftwareConfig {
            image: Some(image),
            ..Default::default()
        }),
        ..Default::default()
    };

    // Set configuration with image
    let set_config_result = service
        .call(message::SetConfig::new(product, Some(config)))
        .await;
    assert!(set_config_result.is_ok());

    // Proposal should reflect image deployment (zero used space, no patterns)
    let proposal = service
        .call(message::GetProposal)
        .await
        .expect("Failed to get proposal")
        .expect("Expected proposal to be present");

    let software_prop = proposal.software.expect("Expected software proposal");
    assert_eq!(software_prop.used_space, 0);
    assert!(software_prop.patterns.is_empty());

    // System info should have no patterns
    let system = service
        .call(message::GetSystem)
        .await
        .expect("Failed to get system info");
    assert!(system.patterns.is_empty());
    assert!(system.registration.is_none());

    // Pattern check should return false
    let is_selected = service
        .call(message::IsPatternSelected::new("gnome".to_string()))
        .await
        .expect("Failed to check pattern");
    assert!(!is_selected);
}

#[tokio::test]
async fn test_service_image_model_install_and_finish() {
    let (tx, _rx) = channel(16);
    let issues = issue::Service::starter(tx.clone()).start();
    let l10n = agama_l10n::Service::starter(tx.clone(), issues.clone())
        .start()
        .await
        .expect("Failed to start l10n service");
    let questions = question::start(tx.clone()).await.unwrap();
    let progress = progress::Service::starter(tx.clone()).start();
    let security = security::test_utils::start_service(questions.clone()).await;

    // Create a real tarball
    let temp_src = TempDir::new().unwrap();
    let sample_file = temp_src.path().join("installed_os_marker.txt");
    std::fs::write(&sample_file, "image os content\n").unwrap();

    let tar_path = temp_src.path().join("gold.tar");
    let create_tar = std::process::Command::new("tar")
        .args([
            "-cf",
            tar_path.to_str().unwrap(),
            "-C",
            temp_src.path().to_str().unwrap(),
            "installed_os_marker.txt",
        ])
        .output()
        .unwrap();
    assert!(create_tar.status.success());

    let temp_dest = TempDir::new().unwrap();
    let image_config = ImageConfig::new(tar_path.to_str().unwrap(), ImageType::Tarball);

    let image_model = ImageModel::new(
        image_config.clone(),
        temp_dest.path(),
        progress.clone(),
        questions.clone(),
    );

    let service = Service::starter(tx, issues, l10n, progress, questions, security)
        .with_model(image_model)
        .start()
        .await
        .expect("Failed to start software service");

    let product = create_test_product();
    let config = Config {
        software: Some(SoftwareConfig {
            image: Some(image_config),
            ..Default::default()
        }),
        ..Default::default()
    };

    service
        .call(message::SetConfig::new(product, Some(config)))
        .await
        .expect("Failed to set config");

    // Perform Install
    let install_result = service.call(message::Install).await;
    assert!(install_result.is_ok());

    // Verify file extracted
    let extracted_file = temp_dest.path().join("installed_os_marker.txt");
    assert!(extracted_file.exists());
    let content = std::fs::read_to_string(extracted_file).unwrap();
    assert_eq!(content, "image os content\n");

    // Perform Finish
    let finish_result = service.call(message::Finish).await;
    assert!(finish_result.is_ok());
}

#[tokio::test]
async fn test_service_image_deployment_with_required_packages() {
    let (service, _events_rx) = start_test_software_service().await;
    let product = create_test_product();

    let image = ImageConfig::new("/images/tumbleweed.tar.xz", ImageType::Tarball)
        .with_install_required_packages(true);

    let config = Config {
        software: Some(SoftwareConfig {
            image: Some(image),
            ..Default::default()
        }),
        ..Default::default()
    };

    let set_config_result = service
        .call(message::SetConfig::new(product, Some(config)))
        .await;
    assert!(set_config_result.is_ok());
}
