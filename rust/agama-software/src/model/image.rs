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
//! during image-based deployment.
//!
//! Features:
//! - Direct parallel streaming for tarballs (curl | decompressor -T0 | tar) avoiding RAM and disk overhead.
//! - Multi-threaded decompressors (xz, zstd, gzip, bzip2).
//! - Remote URL downloads via curl directly to target disk without RAM allocation.
//! - Global `insecure` flag support for curl and podman.
//! - Dedicated asynchronous Tokio workers for stderr logging with rolling 5-line error capture.
//! - Optional hardware enablement and Agama required packages/patterns via zypper in chroot.

use std::{
    collections::{HashMap, VecDeque},
    path::{Path, PathBuf},
    process::Stdio,
    sync::Mutex,
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
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{ChildStderr, Command},
};

use crate::{
    model::{state::SoftwareState, ModelAdapter, WriteIssues},
    service,
};

/// Spawns an asynchronous Tokio worker that logs each line of stderr in real-time
/// and preserves the last 5 lines for error reporting.
fn spawn_stderr_logger(
    tool_name: &'static str,
    stderr: ChildStderr,
) -> tokio::task::JoinHandle<Vec<String>> {
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut last_lines = VecDeque::with_capacity(5);

        while let Ok(Some(line)) = reader.next_line().await {
            tracing::info!("{tool_name}: {line}");
            if last_lines.len() >= 5 {
                last_lines.pop_front();
            }
            last_lines.push_back(line);
        }

        last_lines.into()
    })
}

/// Joins the stderr logger handle and returns the last lines formatted as a string.
async fn collect_last_lines(handle: tokio::task::JoinHandle<Vec<String>>) -> String {
    handle.await.unwrap_or_default().join("\n")
}

/// Model adapter for deploying pre-built system images.
pub struct ImageModel {
    image_config: ImageConfig,
    install_dir: PathBuf,
    selected_product: Option<ProductSpec>,
    software_state: Mutex<Option<SoftwareState>>,
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
            software_state: Mutex::new(None),
            progress,
            _questions: questions,
        }
    }

    /// Returns the image configuration.
    pub fn image_config(&self) -> &ImageConfig {
        &self.image_config
    }

    /// Executes the deployment of the image, optional hardware enablement, and optional required packages.
    pub async fn deploy(&self) -> Result<bool, service::Error> {
        let install_hardware_packages = self.image_config.install_hardware_packages();
        let install_required_packages = self.image_config.install_required_packages();

        let mut total_steps = 1;
        if install_hardware_packages {
            total_steps += 1;
        }
        if install_required_packages {
            total_steps += 1;
        }

        let _ = self.progress.cast(progress::message::SetProgress::new(Progress::new(
            Scope::Software,
            total_steps,
            gettext("Starting image deployment"),
        )));

        // Step 1: Deploy image
        self.deploy_image().await?;

        // Step 2: Install required Agama packages/patterns if requested (before hardware enablement,
        // so supplements based on installed software like the kernel can match correctly)
        if install_required_packages {
            let _ = self.progress.cast(progress::message::NextWithStep::new(
                Scope::Software,
                &gettext("Installing required system packages and patterns"),
            ));
            self.install_required_system_packages().await?;
        }

        // Step 3: Hardware enablement if requested
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
            ImageType::Tarball => self.deploy_tarball(&self.image_config.path).await,
            ImageType::Raw => self.deploy_raw(&self.image_config.path).await,
            ImageType::Oci => self.deploy_oci().await,
        }
    }

    /// Selects the multi-threaded decompressor and parallel arguments for a tarball.
    fn tarball_decompressor(&self, path: &str) -> Option<(&'static str, Vec<&'static str>)> {
        if path.ends_with(".tar.xz") || path.ends_with(".txz") || path.ends_with(".xz") {
            Some(("xz", vec!["-dc", "-T0"]))
        } else if path.ends_with(".tar.zst") || path.ends_with(".tzst") || path.ends_with(".zst") {
            Some(("zstd", vec!["-dc", "-T0"]))
        } else if path.ends_with(".tar.gz") || path.ends_with(".tgz") || path.ends_with(".gz") {
            Some(("gzip", vec!["-dc"]))
        } else if path.ends_with(".tar.bz2") || path.ends_with(".tbz2") || path.ends_with(".bz2") {
            Some(("bzip2", vec!["-dc"]))
        } else {
            None
        }
    }

    /// Deploys a tarball rootfs image directly using parallel streaming into `tar`.
    ///
    /// If the path is a URL, it streams directly from `curl` into the parallel decompressor
    /// (e.g. `xz -dc -T0`, `zstd -dc -T0`), which pipes directly into `tar` on the destination disk,
    /// avoiding intermediate files and eliminating RAM usage.
    async fn deploy_tarball(&self, path: &str) -> Result<(), service::Error> {
        let install_dir = self.install_dir.to_string_lossy().to_string();
        let is_url = self.image_config.is_url();
        let insecure = self.image_config.insecure();
        let decompressor = self.tarball_decompressor(path);

        tracing::info!("Deploying tarball '{path}' into '{install_dir}' with parallel streaming");

        let tar_args = vec![
            "--xattrs",
            "--xattrs-include=*",
            "--acls",
            "--numeric-owner",
            "-xf",
            "-",
            "-C",
            &install_dir,
        ];

        if is_url {
            // Case 1: Remote URL -> curl | [decompressor] | tar
            let mut curl_cmd = Command::new("curl");
            curl_cmd.args(["-sSL", "-f", "--retry", "3"]);
            if insecure {
                curl_cmd.arg("--insecure");
            }
            curl_cmd.arg(path);
            curl_cmd.stdout(Stdio::piped());
            curl_cmd.stderr(Stdio::piped());

            let mut curl_child = curl_cmd.spawn().map_err(|e| {
                service::Error::ImageDeploymentFailed(format!("Failed to spawn curl: {e}"))
            })?;

            let curl_stdout = curl_child.stdout.take().unwrap();
            let curl_stderr = curl_child.stderr.take().unwrap();
            let curl_logger = spawn_stderr_logger("curl", curl_stderr);

            let curl_stdio: Stdio = curl_stdout.try_into().map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to convert curl stdout to Stdio: {e}"
                ))
            })?;

            if let Some((decomp_bin, decomp_args)) = decompressor {
                // curl | decompressor -T0 | tar
                let mut decomp_cmd = Command::new(decomp_bin);
                decomp_cmd.args(&decomp_args);
                decomp_cmd.stdin(curl_stdio);
                decomp_cmd.stdout(Stdio::piped());
                decomp_cmd.stderr(Stdio::piped());

                let mut decomp_child = decomp_cmd.spawn().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!(
                        "Failed to spawn {decomp_bin}: {e}"
                    ))
                })?;

                let decomp_stdout = decomp_child.stdout.take().unwrap();
                let decomp_stderr = decomp_child.stderr.take().unwrap();
                let decomp_logger = spawn_stderr_logger(decomp_bin, decomp_stderr);

                let decomp_stdio: Stdio = decomp_stdout.try_into().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!(
                        "Failed to convert {decomp_bin} stdout to Stdio: {e}"
                    ))
                })?;

                let mut tar_cmd = Command::new("tar");
                tar_cmd.args(&tar_args);
                tar_cmd.stdin(decomp_stdio);
                tar_cmd.stderr(Stdio::piped());

                let mut tar_child = tar_cmd.spawn().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("Failed to spawn tar: {e}"))
                })?;

                let tar_stderr = tar_child.stderr.take().unwrap();
                let tar_logger = spawn_stderr_logger("tar", tar_stderr);

                let (curl_res, decomp_res, tar_res) = tokio::join!(
                    curl_child.wait(),
                    decomp_child.wait(),
                    tar_child.wait(),
                );

                let curl_status = curl_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("curl wait failed: {e}"))
                })?;
                let decomp_status = decomp_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("{decomp_bin} wait failed: {e}"))
                })?;
                let tar_status = tar_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("tar wait failed: {e}"))
                })?;

                if !curl_status.success() {
                    let err = collect_last_lines(curl_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "curl download failed:\n{err}"
                    )));
                }
                if !decomp_status.success() {
                    let err = collect_last_lines(decomp_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "{decomp_bin} decompression failed:\n{err}"
                    )));
                }
                if !tar_status.success() {
                    let err = collect_last_lines(tar_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "tar extraction failed:\n{err}"
                    )));
                }
            } else {
                // curl | tar (uncompressed tar stream)
                let mut tar_cmd = Command::new("tar");
                tar_cmd.args(&tar_args);
                tar_cmd.stdin(curl_stdio);
                tar_cmd.stderr(Stdio::piped());

                let mut tar_child = tar_cmd.spawn().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("Failed to spawn tar: {e}"))
                })?;

                let tar_stderr = tar_child.stderr.take().unwrap();
                let tar_logger = spawn_stderr_logger("tar", tar_stderr);

                let (curl_res, tar_res) = tokio::join!(curl_child.wait(), tar_child.wait());

                let curl_status = curl_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("curl wait failed: {e}"))
                })?;
                let tar_status = tar_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("tar wait failed: {e}"))
                })?;

                if !curl_status.success() {
                    let err = collect_last_lines(curl_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "curl download failed:\n{err}"
                    )));
                }
                if !tar_status.success() {
                    let err = collect_last_lines(tar_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "tar extraction failed:\n{err}"
                    )));
                }
            }
        } else {
            // Case 2: Local file
            if let Some((decomp_bin, decomp_args)) = decompressor {
                // decompressor -T0 <path> | tar -xf - -C <install_dir>
                let mut decomp_cmd = Command::new(decomp_bin);
                decomp_cmd.args(&decomp_args);
                decomp_cmd.arg(path);
                decomp_cmd.stdout(Stdio::piped());
                decomp_cmd.stderr(Stdio::piped());

                let mut decomp_child = decomp_cmd.spawn().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!(
                        "Failed to spawn {decomp_bin}: {e}"
                    ))
                })?;

                let decomp_stdout = decomp_child.stdout.take().unwrap();
                let decomp_stderr = decomp_child.stderr.take().unwrap();
                let decomp_logger = spawn_stderr_logger(decomp_bin, decomp_stderr);

                let decomp_stdio: Stdio = decomp_stdout.try_into().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!(
                        "Failed to convert {decomp_bin} stdout to Stdio: {e}"
                    ))
                })?;

                let mut tar_cmd = Command::new("tar");
                tar_cmd.args(&tar_args);
                tar_cmd.stdin(decomp_stdio);
                tar_cmd.stderr(Stdio::piped());

                let mut tar_child = tar_cmd.spawn().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("Failed to spawn tar: {e}"))
                })?;

                let tar_stderr = tar_child.stderr.take().unwrap();
                let tar_logger = spawn_stderr_logger("tar", tar_stderr);

                let (decomp_res, tar_res) = tokio::join!(decomp_child.wait(), tar_child.wait());

                let decomp_status = decomp_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("{decomp_bin} wait failed: {e}"))
                })?;
                let tar_status = tar_res.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("tar wait failed: {e}"))
                })?;

                if !decomp_status.success() {
                    let err = collect_last_lines(decomp_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "{decomp_bin} decompression failed:\n{err}"
                    )));
                }
                if !tar_status.success() {
                    let err = collect_last_lines(tar_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "tar extraction failed:\n{err}"
                    )));
                }
            } else {
                // Local uncompressed tarball: tar -xf <path> -C <install_dir>
                let mut tar_cmd = Command::new("tar");
                tar_cmd.args([
                    "--xattrs",
                    "--xattrs-include=*",
                    "--acls",
                    "--numeric-owner",
                    "-xf",
                    path,
                    "-C",
                    &install_dir,
                ]);
                tar_cmd.stderr(Stdio::piped());

                let mut tar_child = tar_cmd.spawn().map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("Failed to spawn tar: {e}"))
                })?;

                let tar_stderr = tar_child.stderr.take().unwrap();
                let tar_logger = spawn_stderr_logger("tar", tar_stderr);

                let tar_status = tar_child.wait().await.map_err(|e| {
                    service::Error::ImageDeploymentFailed(format!("tar wait failed: {e}"))
                })?;

                if !tar_status.success() {
                    let err = collect_last_lines(tar_logger).await;
                    return Err(service::Error::ImageDeploymentFailed(format!(
                        "tar extraction failed:\n{err}"
                    )));
                }
            }
        }

        Ok(())
    }

    /// Deploys a raw filesystem or disk image, handling remote URLs and compression directly to disk.
    async fn deploy_raw(&self, path: &str) -> Result<(), service::Error> {
        let local_path = if self.image_config.is_url() {
            let download_path = self.install_dir.join(".agama_image_download.tmp");
            let download_path_str = download_path.to_string_lossy().to_string();

            tracing::info!("Downloading raw image from '{path}' to '{download_path_str}'");

            let mut curl_cmd = Command::new("curl");
            curl_cmd.args(["-sSL", "-f", "--retry", "3", "-o", &download_path_str]);
            if self.image_config.insecure() {
                curl_cmd.arg("--insecure");
            }
            curl_cmd.arg(path);
            curl_cmd.stderr(Stdio::piped());

            let mut curl_child = curl_cmd.spawn().map_err(|e| {
                service::Error::ImageDeploymentFailed(format!("Failed to spawn curl: {e}"))
            })?;

            let curl_stderr = curl_child.stderr.take().unwrap();
            let curl_logger = spawn_stderr_logger("curl", curl_stderr);
            let curl_status = curl_child.wait().await.map_err(|e| {
                service::Error::ImageDeploymentFailed(format!("curl wait failed: {e}"))
            })?;

            if !curl_status.success() {
                let err = collect_last_lines(curl_logger).await;
                _ = tokio::fs::remove_file(&download_path).await;
                return Err(service::Error::ImageDeploymentFailed(format!(
                    "Failed to download raw image from '{path}':\n{err}"
                )));
            }

            let deploy_res = self.deploy_local_raw(&download_path_str).await;
            _ = tokio::fs::remove_file(&download_path).await;
            return deploy_res;
        } else {
            path.to_string()
        };

        self.deploy_local_raw(&local_path).await
    }

    /// Deploys a local raw image, decompressing it first if compressed (xz, bzip2, gzip, zstd).
    async fn deploy_local_raw(&self, path: &str) -> Result<(), service::Error> {
        if let Some(decompressor) = self.detect_compression(path) {
            let decompressed_path = self.install_dir.join(".agama_decompressed_image.raw");
            let decompressed_str = decompressed_path.to_string_lossy().to_string();

            tracing::info!(
                "Decompressing raw image '{path}' to '{decompressed_str}' using {decompressor}"
            );

            let decomp_res = self
                .decompress_file(decompressor, path, &decompressed_path)
                .await;

            if let Err(e) = decomp_res {
                _ = tokio::fs::remove_file(&decompressed_path).await;
                return Err(e);
            }

            let deploy_res = self.deploy_uncompressed_raw(&decompressed_str).await;
            _ = tokio::fs::remove_file(&decompressed_path).await;
            deploy_res
        } else {
            self.deploy_uncompressed_raw(path).await
        }
    }

    /// Detects compression based on file extension and magic bytes.
    fn detect_compression(&self, path: &str) -> Option<&'static str> {
        if path.ends_with(".xz") || path.ends_with(".lzma") {
            return Some("xz");
        }
        if path.ends_with(".bz2") {
            return Some("bzip2");
        }
        if path.ends_with(".gz") {
            return Some("gzip");
        }
        if path.ends_with(".zst") || path.ends_with(".zstd") {
            return Some("zstd");
        }

        // Check magic bytes if file exists locally
        if let Ok(mut file) = std::fs::File::open(path) {
            use std::io::Read;
            let mut magic = [0u8; 6];
            if file.read_exact(&mut magic).is_ok() {
                if magic.starts_with(b"\xFD7zXZ\x00") {
                    return Some("xz");
                }
                if magic.starts_with(b"BZh") {
                    return Some("bzip2");
                }
                if magic.starts_with(b"\x1F\x8B") {
                    return Some("gzip");
                }
                if magic.starts_with(b"\x28\xB5\x2F\xFD") {
                    return Some("zstd");
                }
            }
        }

        None
    }

    /// Decompresses a compressed image file directly to the destination disk.
    async fn decompress_file(
        &self,
        decompressor: &str,
        source_path: &str,
        destination_path: &Path,
    ) -> Result<(), service::Error> {
        let dest_file = std::fs::File::create(destination_path).map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to create temporary decompressed file: {e}"
            ))
        })?;

        let args = if decompressor == "xz" || decompressor == "zstd" {
            vec!["-dc", "-T0"]
        } else {
            vec!["-dc"]
        };

        let mut cmd = Command::new(decompressor);
        cmd.args(&args);
        cmd.arg(source_path);
        cmd.stdout(dest_file);
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("Failed to spawn {decompressor}: {e}"))
        })?;

        let stderr = child.stderr.take().unwrap();
        let logger = spawn_stderr_logger(
            if decompressor == "xz" {
                "xz"
            } else if decompressor == "zstd" {
                "zstd"
            } else if decompressor == "gzip" {
                "gzip"
            } else {
                "bzip2"
            },
            stderr,
        );

        let status = child.wait().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("{decompressor} wait failed: {e}"))
        })?;

        if !status.success() {
            let err = collect_last_lines(logger).await;
            return Err(service::Error::ImageDeploymentFailed(format!(
                "{decompressor} decompression failed:\n{err}"
            )));
        }

        Ok(())
    }

    /// Deploys an uncompressed raw filesystem or disk image via loop mount and file copy.
    async fn deploy_uncompressed_raw(&self, path: &str) -> Result<(), service::Error> {
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
        let mut mount_cmd = Command::new("mount");
        mount_cmd.args(["-o", "loop,ro", path, &temp_mount_str]);
        mount_cmd.stderr(Stdio::piped());

        let direct_mount_ok = if let Ok(mut mount_child) = mount_cmd.spawn() {
            let mount_stderr = mount_child.stderr.take().unwrap();
            let mount_logger = spawn_stderr_logger("mount", mount_stderr);
            let status = mount_child.wait().await;
            match status {
                Ok(s) if s.success() => true,
                _ => {
                    let _ = collect_last_lines(mount_logger).await;
                    false
                }
            }
        } else {
            false
        };

        if direct_mount_ok {
            let copy_res = self.copy_files(&temp_mount_str, &install_dir).await;
            _ = Command::new("umount").arg(&*temp_mount_str).output().await;
            copy_res?;
            return Ok(());
        }

        // Second attempt: partitioned disk image using losetup
        let mut losetup_cmd = Command::new("losetup");
        losetup_cmd.args(["-fP", "--show", path]);
        losetup_cmd.stdout(Stdio::piped());
        losetup_cmd.stderr(Stdio::piped());

        let mut losetup_child = losetup_cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("Failed to spawn losetup: {e}"))
        })?;

        let losetup_stdout = losetup_child.stdout.take().unwrap();
        let losetup_stderr = losetup_child.stderr.take().unwrap();
        let losetup_logger = spawn_stderr_logger("losetup", losetup_stderr);

        let mut loop_dev_buf = Vec::new();
        let mut stdout_reader = tokio::io::BufReader::new(losetup_stdout);
        let (status_res, read_res) = tokio::join!(
            losetup_child.wait(),
            tokio::io::AsyncReadExt::read_to_end(&mut stdout_reader, &mut loop_dev_buf),
        );

        let status = status_res.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("losetup wait failed: {e}"))
        })?;
        read_res.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("losetup read failed: {e}"))
        })?;

        if !status.success() {
            let err = collect_last_lines(losetup_logger).await;
            return Err(service::Error::ImageDeploymentFailed(format!(
                "losetup failed:\n{err}"
            )));
        }

        let loop_dev = String::from_utf8_lossy(&loop_dev_buf).trim().to_string();
        let partition_dev = self.find_root_partition(&loop_dev);

        let mut mount_part_cmd = Command::new("mount");
        mount_part_cmd.args(["-o", "ro", &partition_dev, &temp_mount_str]);
        mount_part_cmd.stderr(Stdio::piped());

        let mut mount_part_child = mount_part_cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("Failed to spawn mount: {e}"))
        })?;

        let mount_stderr = mount_part_child.stderr.take().unwrap();
        let mount_logger = spawn_stderr_logger("mount", mount_stderr);
        let mount_status = mount_part_child.wait().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("mount wait failed: {e}"))
        })?;

        let result = if mount_status.success() {
            let copy_res = self.copy_files(&temp_mount_str, &install_dir).await;
            _ = Command::new("umount").arg(&*temp_mount_str).output().await;
            copy_res
        } else {
            let err = collect_last_lines(mount_logger).await;
            Err(service::Error::ImageDeploymentFailed(format!(
                "Failed to mount partition {partition_dev}:\n{err}"
            )))
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

    /// Copies files from a directory into the installation directory using `cp -a`.
    async fn copy_files(&self, source_dir: &str, target_dir: &str) -> Result<(), service::Error> {
        let src_pattern = format!("{source_dir}/.");
        let target = format!("{target_dir}/");

        tracing::info!("Copying files from '{src_pattern}' to '{target}'");

        let mut cp_cmd = Command::new("cp");
        cp_cmd.args(["-a", &src_pattern, &target]);
        cp_cmd.stderr(Stdio::piped());

        let mut cp_child = cp_cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("Failed to spawn cp: {e}"))
        })?;

        let cp_stderr = cp_child.stderr.take().unwrap();
        let cp_logger = spawn_stderr_logger("cp", cp_stderr);

        let status = cp_child.wait().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("cp wait failed: {e}"))
        })?;

        if !status.success() {
            let err = collect_last_lines(cp_logger).await;
            return Err(service::Error::ImageDeploymentFailed(format!(
                "cp failed:\n{err}"
            )));
        }

        Ok(())
    }

    /// Deploys an OCI container image directly using `podman export` piped into `tar`.
    async fn deploy_oci(&self) -> Result<(), service::Error> {
        let image_ref = &self.image_config.path;
        let insecure = self.image_config.insecure();
        let install_dir = self.install_dir.to_string_lossy().to_string();

        tracing::info!("Deploying OCI image '{image_ref}' into '{install_dir}' using podman export");

        let container_name = "agama-oci-deploy";

        // Create container definition
        let mut cmd = Command::new("podman");
        cmd.arg("create");
        if insecure {
            cmd.arg("--tls-verify=false");
        }
        cmd.args(["--name", container_name, image_ref]);
        cmd.stderr(Stdio::piped());

        let mut create_child = cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("Failed to spawn podman create: {e}"))
        })?;

        let create_stderr = create_child.stderr.take().unwrap();
        let create_logger = spawn_stderr_logger("podman create", create_stderr);
        let create_status = create_child.wait().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("podman create wait failed: {e}"))
        })?;

        if !create_status.success() {
            let err = collect_last_lines(create_logger).await;
            return Err(service::Error::ImageDeploymentFailed(format!(
                "podman create failed:\n{err}"
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

    /// Pipes `podman export` stdout into `tar` stdin to stream extraction directly to disk.
    async fn export_container_to_target(
        &self,
        container_name: &str,
        target_dir: &str,
    ) -> Result<(), service::Error> {
        let mut export_child = Command::new("podman")
            .args(["export", container_name])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!(
                    "Failed to spawn podman export: {e}"
                ))
            })?;

        let export_stdout = export_child.stdout.take().unwrap();
        let export_stderr = export_child.stderr.take().unwrap();
        let export_logger = spawn_stderr_logger("podman export", export_stderr);

        let tar_stdin: Stdio = export_stdout.try_into().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to convert podman export stdout to Stdio: {e}"
            ))
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
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                service::Error::ImageDeploymentFailed(format!("Failed to spawn tar: {e}"))
            })?;

        let tar_stderr = tar_child.stderr.take().unwrap();
        let tar_logger = spawn_stderr_logger("tar", tar_stderr);

        let (export_res, tar_res) = tokio::join!(export_child.wait(), tar_child.wait());

        let export_status = export_res.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("podman export wait failed: {e}"))
        })?;
        let tar_status = tar_res.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("tar wait failed: {e}"))
        })?;

        if !export_status.success() {
            let err = collect_last_lines(export_logger).await;
            return Err(service::Error::ImageDeploymentFailed(format!(
                "podman export failed:\n{err}"
            )));
        }

        if !tar_status.success() {
            let err = collect_last_lines(tar_logger).await;
            return Err(service::Error::ImageDeploymentFailed(format!(
                "tar extraction failed:\n{err}"
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
        chroot_cmd.stderr(Stdio::piped());

        let mut child = chroot_cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to spawn zypper hardware enablement: {e}"
            ))
        })?;

        let stderr = child.stderr.take().unwrap();
        let logger = spawn_stderr_logger("zypper inr", stderr);

        let status = child.wait().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("zypper inr wait failed: {e}"))
        })?;

        if !status.success() {
            let err = collect_last_lines(logger).await;
            tracing::warn!("Hardware enablement command completed with non-zero exit code:\n{err}");
        } else {
            tracing::info!("Hardware enablement completed successfully");
        }

        Ok(())
    }

    /// Installs required system packages and patterns (kernel, storage, bootloader) via zypper in chroot.
    async fn install_required_system_packages(&self) -> Result<(), service::Error> {
        let pkgs = self
            .software_state
            .lock()
            .unwrap()
            .as_ref()
            .map(|s| s.resolvables.selected_resolvable_names())
            .unwrap_or_default();

        if pkgs.is_empty() {
            tracing::info!("No required system packages or patterns to install");
            return Ok(());
        }

        tracing::info!("Installing required system packages and patterns: {pkgs:?}");

        let mut chroot_cmd = ChrootCommand::new(&self.install_dir).map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to initialize chroot command: {e}"
            ))
        })?;

        chroot_cmd.arg("zypper");
        chroot_cmd.arg("--non-interactive");
        chroot_cmd.arg("in");
        chroot_cmd.arg("--no-recommends");
        chroot_cmd.args(&pkgs);
        chroot_cmd.stderr(Stdio::piped());

        let mut child = chroot_cmd.spawn().map_err(|e| {
            service::Error::ImageDeploymentFailed(format!(
                "Failed to spawn zypper for required packages: {e}"
            ))
        })?;

        let stderr = child.stderr.take().unwrap();
        let logger = spawn_stderr_logger("zypper in", stderr);

        let status = child.wait().await.map_err(|e| {
            service::Error::ImageDeploymentFailed(format!("zypper wait failed: {e}"))
        })?;

        if !status.success() {
            let err = collect_last_lines(logger).await;
            tracing::error!("Installation of required packages failed:\n{err}");
            return Err(service::Error::ImageDeploymentFailed(format!(
                "Installation of required packages failed:\n{err}"
            )));
        }

        tracing::info!("Required system packages installed successfully");
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
        software: SoftwareState,
        _l10n: Handler<agama_l10n::Service>,
        _progress: Handler<progress::Service>,
    ) -> Result<WriteIssues, service::Error> {
        *self.software_state.lock().unwrap() = Some(software);
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
    async fn test_deploy_tarball_compressed_stream_url() {
        let (progress, questions) = create_test_handlers().await;

        let temp_src = TempDir::new().unwrap();
        let sample_file = temp_src.path().join("streamed.txt");
        std::fs::write(&sample_file, "streamed content\n").unwrap();

        let tar_path = temp_src.path().join("image.tar.gz");
        let create_tar = std::process::Command::new("tar")
            .args([
                "-czf",
                tar_path.to_str().unwrap(),
                "-C",
                temp_src.path().to_str().unwrap(),
                "streamed.txt",
            ])
            .output()
            .unwrap();
        assert!(create_tar.status.success());

        let file_url = url::Url::from_file_path(&tar_path).unwrap().to_string();
        let temp_dest = TempDir::new().unwrap();
        let image_config = ImageConfig::new(file_url, ImageType::Tarball);
        assert!(image_config.is_url());

        let model = ImageModel::new(image_config, temp_dest.path(), progress, questions);

        let result = model.deploy().await;
        assert!(result.is_ok());
        assert!(result.unwrap());

        let extracted_file = temp_dest.path().join("streamed.txt");
        assert!(extracted_file.exists());
        let content = std::fs::read_to_string(extracted_file).unwrap();
        assert_eq!(content, "streamed content\n");
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
