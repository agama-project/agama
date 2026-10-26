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

//! Model adapter for image-based deployment.
//!
//! Provides deployment of pre-built system images (tarball, raw image, OCI)
//! instead of package-by-package RPM installation. zypp server does not run
//! during image-based deployment, and optional hardware enablement is performed
//! using `zypper inr --no-recommends` inside the target system after extraction.
//!
//! It utilizes standard Agama command infrastructure (`tokio::process::Command`
//! and `agama_utils::command::ChrootCommand`).

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use agama_l10n;
use agama_utils::{
    actor::Handler,
    api::{
        software::{ImageConfig, ImageType, Repository, SoftwareProposal, SystemInfo},
        Progress, Scope,
    },
    command::ChrootCommand,
    products::ProductSpec,
    progress, question,
};
use async_trait::async_trait;
use gettextrs::gettext;
use tokio::process::Command;

use crate::{
    model::{state::SoftwareState, ModelAdapter, WriteIssues},
    service,
};

/// Model adapter for deploying pre-built system images.
pub struct ImageModel {
    image_config: ImageConfig,
    install_dir: PathBuf,
    selected_product: Option<ProductSpec>,
    progress: Handler<progress::Service>,
    _questions: Handler<question::Service>,
}

impl ImageModel {
    /// Creates a new `ImageModel`.
    pub fn new(
        image_config: ImageConfig,
        install_dir: impl Into<PathBuf>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
    ) -> Self {
        Self {
            image_config,
            install_dir: install_dir.into(),
            selected_product: None,
            progress,
            _questions: questions,
        }
    }

    /// Returns the image configuration.
    pub fn image_config(&self) -> &ImageConfig {
        &self.image_config
    }

    /// Executes the deployment of the image and optional hardware enablement.
    pub async fn deploy(&self) -> Result<bool, service::Error> {
        let install_hardware_packages = self.image_config.install_hardware_packages();
        let total_steps = if install_hardware_packages { 2 } else { 1 };

        let _ = self.progress.cast(progress::message::SetProgress::new(Progress::new(
            Scope::Software,
            total_steps,
            gettext("Starting image deployment"),
        )));

        // Step 1: Deploy image
        self.deploy_image().await?;

        // Step 2: Hardware enablement if requested
        if install_hardware_packages {
            let _ = self.progress.cast(progress::message::NextWithStep::new(
                Scope::Software,
                &gettext("Installing recommended hardware packages"),
            ));
            self.enable_hardware().await?;
        }

        let _ = self.progress.cast(progress::message::Finish::new(Scope::Software));
        tracing::info!("Image deployment finished successfully");
        Ok(true)
    }

    /// Deploys the image according to its configured type.
    async fn deploy_image(&self) -> Result<(), service::Error> {
        match self.image_config.image_type {
            ImageType::Tarball => self.deploy_tarball().await,
            ImageType::Raw => self.deploy_raw().await,
            ImageType::Oci => self.deploy_oci().await,
        }
    }

    /// Deploys a tarball rootfs image using `tar`, preserving ACLs, extended attributes, and SELinux contexts.
    async fn deploy_tarball(&self) -> Result<(), service::Error> {
        let path = &self.image_config.path;
        let install_dir = self.install_dir.to_string_lossy();

        tracing::info!("Deploying tarball image '{path}' into '{install_dir}'");

        let output = Command::new("tar")
            .args([
                "--xattrs",
                "--xattrs-include=*",
                "--acls",
                "--numeric-owner",
                "-xf",
                path,
                "-C",
                &install_dir,
            ])
            .output()
            .await
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to execute tar command: {e}"
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::error!("tar extraction failed: {stderr}");
            return Err(service::Error::ImageDeploymentFailed(format!(
                "tar extraction failed: {stderr}"
            )));
        }

        Ok(())
    }

    /// Copies files from a directory into the installation directory using `cp -a`.
    async fn copy_files(
        &self,
        source_dir: &str,
        target_dir: &str,
    ) -> Result<(), service::Error> {
        let src_pattern = format!("{source_dir}/.");
        let target = format!("{target_dir}/");

        tracing::info!("Copying files from '{src_pattern}' to '{target}'");

        let output = Command::new("cp")
            .args(["-a", &src_pattern, &target])
            .output()
            .await
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to copy files: {e}"
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::error!("cp failed: {stderr}");
            return Err(service::Error::ImageDeploymentFailed(format!(
                "cp failed: {stderr}"
            )));
        }

        Ok(())
    }

    /// Deploys a raw filesystem or disk image.
    async fn deploy_raw(&self) -> Result<(), service::Error> {
        let path = &self.image_config.path;
        let install_dir = self.install_dir.to_string_lossy();

        tracing::info!("Deploying raw image '{path}' into '{install_dir}'");

        let temp_mount = tempfile::Builder::new()
            .prefix("agama-image-mount-")
            .tempdir()
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to create temporary mount directory: {e}"
                ))
            })?;
        let temp_mount_str = temp_mount.path().to_string_lossy();

        // First attempt: direct loop mount (filesystem image)
        let mount_res = Command::new("mount")
            .args(["-o", "loop,ro", path, &temp_mount_str])
            .output()
            .await;

        let direct_mount_ok = match mount_res {
            Ok(output) if output.status.success() => true,
            _ => false,
        };

        if direct_mount_ok {
            let copy_res = self.copy_files(&temp_mount_str, &install_dir).await;
            _ = Command::new("umount").arg(&*temp_mount_str).output().await;
            copy_res?;
            return Ok(());
        }

        // Second attempt: partitioned disk image using losetup
        let losetup_output = Command::new("losetup")
            .args(["-fP", "--show", path])
            .output()
            .await
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to run losetup: {e}"
                ))
            })?;

        if !losetup_output.status.success() {
            let stderr = String::from_utf8_lossy(&losetup_output.stderr);
            tracing::error!("losetup failed: {stderr}");
            return Err(service::Error::ImageDeploymentFailed(format!(
                "Failed to mount raw image: direct mount failed and losetup failed: {stderr}"
            )));
        }

        let loop_dev = String::from_utf8_lossy(&losetup_output.stdout)
            .trim()
            .to_string();

        let partition_dev = self.find_root_partition(&loop_dev);

        let mount_part_res = Command::new("mount")
            .args(["-o", "ro", &partition_dev, &temp_mount_str])
            .output()
            .await;

        let result = match mount_part_res {
            Ok(output) if output.status.success() => {
                let copy_res = self.copy_files(&temp_mount_str, &install_dir).await;
                _ = Command::new("umount").arg(&*temp_mount_str).output().await;
                copy_res
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                tracing::error!("mount partition failed: {stderr}");
                Err(service::Error::ImageDeploymentFailed(format!(
                    "Failed to mount partition {partition_dev}: {stderr}"
                )))
            }
            Err(e) => Err(service::Error::ImageDeploymentFailed(format!(
                "Failed to run mount for partition {partition_dev}: {e}"
            ))),
        };

        _ = Command::new("losetup")
            .args(["-d", &loop_dev])
            .output()
            .await;

        result
    }

    fn find_root_partition(&self, loop_dev: &str) -> String {
        let p2 = format!("{loop_dev}p2");
        if Path::new(&p2).exists() {
            return p2;
        }
        let p1 = format!("{loop_dev}p1");
        if Path::new(&p1).exists() {
            return p1;
        }
        loop_dev.to_string()
    }

    /// Deploys an OCI container image directly using `podman export` piped into `tar`.
    ///
    /// This streams the container filesystem directly into `/mnt` through a kernel pipe,
    /// avoiding intermediate extraction into RAM (crucial for ramfs live media) and
    /// avoiding nested OverlayFS mount restrictions.
    async fn deploy_oci(&self) -> Result<(), service::Error> {
        let path = &self.image_config.path;
        let install_dir = self.install_dir.to_string_lossy();

        tracing::info!("Deploying OCI image '{path}' into '{install_dir}' using podman export");

        let container_name = "agama-oci-deploy";

        // Create container definition
        let create_output = Command::new("podman")
            .args(["create", "--name", container_name, path])
            .output()
            .await
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to execute podman create: {e}"
                ))
            })?;

        if !create_output.status.success() {
            let stderr = String::from_utf8_lossy(&create_output.stderr);
            return Err(service::Error::ImageDeploymentFailed(format!(
                "podman create failed: {stderr}"
            )));
        }

        // Stream via pipe: podman export <container> | tar -xf - -C <install_dir>
        let export_res = self
            .export_container_to_target(container_name, &install_dir)
            .await;

        _ = Command::new("podman")
            .args(["rm", "-f", container_name])
            .output()
            .await;

        export_res
    }

    /// Pipes `podman export` stdout into `tar` stdin to stream extraction directly to disk,
    /// while concurrently draining both stderr streams to capture real error messages without deadlocks.
    async fn export_container_to_target(
        &self,
        container_name: &str,
        target_dir: &str,
    ) -> Result<(), service::Error> {
        let mut export_child = Command::new("podman")
            .args(["export", container_name])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to spawn podman export: {e}"
                ))
            })?;

        let export_stdout = export_child.stdout.take().ok_or_else(|| {
            service::Error::ImageDeploymentFailed("Failed to capture podman export stdout".into())
        })?;
        let tar_stdin: std::process::Stdio = export_stdout.try_into().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to convert podman export stdout to Stdio: {e}"
            ))
        })?;
        let mut export_stderr = export_child.stderr.take().ok_or_else(|| {
            service::Error::ImageDeploymentFailed("Failed to capture podman export stderr".into())
        })?;

        let mut tar_child = Command::new("tar")
            .args([
                "--xattrs",
                "--xattrs-include=*",
                "--acls",
                "--numeric-owner",
                "-xf",
                "-",
                "-C",
                target_dir,
            ])
            .stdin(tar_stdin)
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to spawn tar extraction: {e}"
                ))
            })?;

        let mut tar_stderr = tar_child.stderr.take().ok_or_else(|| {
            service::Error::ImageDeploymentFailed("Failed to capture tar stderr".into())
        })?;

        let mut export_err_buf = Vec::new();
        let mut tar_err_buf = Vec::new();

        let (export_status, tar_status, _, _) = tokio::try_join!(
            export_child.wait(),
            tar_child.wait(),
            tokio::io::AsyncReadExt::read_to_end(&mut export_stderr, &mut export_err_buf),
            tokio::io::AsyncReadExt::read_to_end(&mut tar_stderr, &mut tar_err_buf),
        )
        .map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "I/O error during podman export and tar streaming: {e}"
            ))
        })?;

        if !export_status.success() {
            let stderr = String::from_utf8_lossy(&export_err_buf);
            tracing::error!("podman export failed: {stderr}");
            return Err(service::Error::ImageDeploymentFailed(format!(
                "podman export failed: {stderr}"
            )));
        }

        if !tar_status.success() {
            let stderr = String::from_utf8_lossy(&tar_err_buf);
            tracing::error!("tar extraction failed: {stderr}");
            return Err(service::Error::ImageDeploymentFailed(format!(
                "tar extraction failed: {stderr}"
            )));
        }

        Ok(())
    }

    /// Performs hardware enablement using `zypper inr --no-recommends` in chroot.
    async fn enable_hardware(&self) -> Result<(), service::Error> {
        tracing::info!("Running hardware enablement with 'zypper inr --no-recommends'");

        let mut chroot_cmd = ChrootCommand::new(&self.install_dir).map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to initialize chroot command: {e}"
            ))
        })?;

        chroot_cmd.args(["zypper", "--non-interactive", "inr", "--no-recommends"]);

        let output = chroot_cmd.output().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to run zypper hardware enablement: {e}"
            ))
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::warn!(
                "Hardware enablement command completed with non-zero exit code: {stderr}"
            );
        } else {
            tracing::info!("Hardware enablement completed successfully");
        }

        Ok(())
    }
}

#[async_trait]
impl ModelAdapter for ImageModel {
    async fn system_info(&self) -> Result<SystemInfo, service::Error> {
        Ok(SystemInfo {
            patterns: vec![],
            registration: None,
        })
    }

    async fn proposal(&self) -> Result<SoftwareProposal, service::Error> {
        Ok(SoftwareProposal {
            used_space: 0,
            patterns: HashMap::new(),
        })
    }

    async fn refresh(&mut self) -> Result<(), service::Error> {
        Ok(())
    }

    async fn install(&self) -> Result<bool, service::Error> {
        self.deploy().await
    }

    async fn finish(&self) -> Result<(), service::Error> {
        Ok(())
    }

    fn set_product(&mut self, product_spec: ProductSpec) {
        self.selected_product = Some(product_spec);
    }

    async fn write(
        &mut self,
        _software: SoftwareState,
        _l10n: Handler<agama_l10n::Service>,
        _progress: Handler<progress::Service>,
    ) -> Result<WriteIssues, service::Error> {
        Ok(WriteIssues::default())
    }

    fn predefined_repositories(&self) -> Vec<Repository> {
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::sync::broadcast::channel;

    async fn create_test_handlers() -> (Handler<progress::Service>, Handler<question::Service>) {
        let (tx, _rx) = channel(16);
        let progress_handler = progress::Service::starter(tx.clone()).start();
        let question_handler = question::start(tx).await.unwrap();
        (progress_handler, question_handler)
    }

    #[tokio::test]
    async fn test_image_model_adapter_methods() {
        let (progress, questions) = create_test_handlers().await;
        let image_config = ImageConfig::new("/images/tw.tar.xz", ImageType::Tarball);
        let mut model = ImageModel::new(image_config, "/mnt", progress.clone(), questions.clone());

        assert!(model.predefined_repositories().is_empty());

        let info = model.system_info().await.unwrap();
        assert!(info.patterns.is_empty());
        assert!(info.registration.is_none());

        let proposal = model.proposal().await.unwrap();
        assert_eq!(proposal.used_space, 0);
        assert!(proposal.patterns.is_empty());

        assert!(model.refresh().await.is_ok());
        assert!(model.finish().await.is_ok());

        let (tx, _rx) = channel(16);
        let issues_handler = agama_utils::issue::Service::starter(tx.clone()).start();
        let l10n_handler = agama_l10n::Service::starter(tx, issues_handler)
            .start()
            .await
            .expect("Failed to start l10n service");

        let issues = model
            .write(
                SoftwareState::new("test"),
                l10n_handler,
                progress,
            )
            .await
            .unwrap();
        assert!(issues.is_empty());
    }

    #[tokio::test]
    async fn test_deploy_tarball_real_extraction() {
        let (progress, questions) = create_test_handlers().await;

        let temp_src = TempDir::new().unwrap();
        let sample_file = temp_src.path().join("hello.txt");
        std::fs::write(&sample_file, "hello from gold image\n").unwrap();

        let tar_path = temp_src.path().join("image.tar");
        let create_tar = std::process::Command::new("tar")
            .args(["-cf", tar_path.to_str().unwrap(), "-C", temp_src.path().to_str().unwrap(), "hello.txt"])
            .output()
            .unwrap();
        assert!(create_tar.status.success());

        let temp_dest = TempDir::new().unwrap();
        let image_config = ImageConfig::new(tar_path.to_str().unwrap(), ImageType::Tarball);
        let model = ImageModel::new(image_config, temp_dest.path(), progress, questions);

        let result = model.deploy().await;
        assert!(result.is_ok());
        assert!(result.unwrap());

        let extracted_file = temp_dest.path().join("hello.txt");
        assert!(extracted_file.exists());
        let content = std::fs::read_to_string(extracted_file).unwrap();
        assert_eq!(content, "hello from gold image\n");
    }

    #[tokio::test]
    async fn test_deploy_nonexistent_tarball_fails() {
        let (progress, questions) = create_test_handlers().await;
        let temp_dest = TempDir::new().unwrap();
        let image_config = ImageConfig::new("/nonexistent/file.tar.xz", ImageType::Tarball);
        let model = ImageModel::new(image_config, temp_dest.path(), progress, questions);

        let result = model.deploy().await;
        assert!(result.is_err());
    }
}
