// Copyright (c) [2025] SUSE LLC
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

//! This crate implements the support for handling files and scripts in Agama.

pub mod service;
pub use service::{Service, Starter};

pub mod message;
mod runner;
pub use runner::ScriptsRunner;

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use agama_software::test_utils::start_service as start_software_service;
    use agama_utils::{
        actor::Handler,
        api::{
            files::{scripts::ScriptsGroup, Config},
            Event,
        },
        issue, progress, question,
    };
    use tempfile::TempDir;
    use test_context::{test_context, AsyncTestContext};
    use tokio::sync::broadcast;

    use crate::{message, service::Error, Service};

    struct Context {
        handler: Handler<Service>,
        tmp_dir: TempDir,
    }

    impl AsyncTestContext for Context {
        async fn setup() -> Context {
            // Set the PATH
            let old_path = std::env::var("PATH").unwrap();
            let bin_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../share/bin");
            std::env::set_var("PATH", format!("{}:{}", &bin_dir.display(), &old_path));

            // Set up the chroot
            let tmp_dir = TempDir::with_prefix("test").unwrap();
            std::fs::create_dir_all(tmp_dir.path().join("usr/bin")).unwrap();
            std::fs::copy("/usr/bin/install", tmp_dir.path().join("usr/bin/install")).unwrap();

            // Set up the service
            let (events_tx, _events_rx) = broadcast::channel::<Event>(16);
            let issues = issue::Service::starter(events_tx.clone()).start();
            let progress = progress::Service::starter(events_tx.clone()).start();
            let questions = question::start(events_tx.clone()).await.unwrap();
            let software = start_software_service(
                events_tx.clone(),
                issues,
                progress.clone(),
                questions.clone(),
            )
            .await;
            let handler = Service::starter(progress, questions, software)
                .with_scripts_workdir(tmp_dir.path())
                .with_install_dir(tmp_dir.path())
                .start()
                .await
                .unwrap();
            Context { handler, tmp_dir }
        }
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_add_and_run_scripts(ctx: &mut Context) -> Result<(), Error> {
        let test_file_1 = ctx.tmp_dir.path().join("file-1.txt");
        let test_file_2 = ctx.tmp_dir.path().join("file-2.txt");

        let pre_script_json = format!(
            "{{ \"name\": \"pre.sh\", \"content\": \"#!/usr/bin/bash\\nset -x\\ntouch {}\" }}",
            test_file_1.to_str().unwrap()
        );

        let init_script_json = format!(
            "{{ \"name\": \"init.sh\", \"content\": \"#!/usr/bin/bash\\ntouch {}\" }}",
            test_file_2.to_str().unwrap()
        );

        let config = format!(
            "{{ \"scripts\": {{ \"pre\": [{}], \"init\": [{}] }} }}",
            pre_script_json, init_script_json
        );

        let config: Config = serde_json::from_str(&config).unwrap();
        ctx.handler
            .call(message::SetConfig::with(config))
            .await
            .unwrap();

        ctx.handler
            .call(message::RunScripts::new(ScriptsGroup::Pre))
            .await
            .unwrap();

        // Check that only the pre-script ran
        assert!(std::fs::exists(&test_file_1).unwrap());
        assert!(!std::fs::exists(&test_file_2).unwrap());
        Ok(())
    }

    #[test_context(Context)]
    #[tokio::test]
    async fn test_add_and_write_files(ctx: &mut Context) -> Result<(), Error> {
        let config =
            r#"{ "files": [{ "destination": "/etc/README.md", "content": "Some text" }] }"#;

        let config: Config = serde_json::from_str(&config).unwrap();
        ctx.handler
            .call(message::SetConfig::with(config))
            .await
            .unwrap();

        ctx.handler.call(message::WriteFiles).await.unwrap();

        // Check that the file exists
        let expected_path = ctx.tmp_dir.path().join("etc/README.md");
        assert!(std::fs::exists(&expected_path).unwrap());
        Ok(())
    }
}
