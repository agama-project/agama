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

//! # D-Bus interface proxy for: `org.opensuse.Agama.Storage1.DASD`

use zbus::proxy;

#[proxy(
    default_service = "org.opensuse.Agama.Storage1",
    default_path = "/org/opensuse/Agama/Storage1/DASD",
    interface = "org.opensuse.Agama.Storage1.DASD",
    assume_defaults = true
)]
pub trait DASD {
    /// Probe method
    fn probe(&self) -> zbus::Result<()>;

    /// Config property
    #[zbus(property)]
    fn config(&self) -> zbus::Result<String>;

    /// System property
    /// Temporary rename to avoid clashing with the system_changed signal.
    #[zbus(property, name = "System")]
    fn dasd_system(&self) -> zbus::Result<String>;

    /// SetConfig method
    fn set_config(&self, serialized_config: &str) -> zbus::Result<()>;

    /// FormatChanged signal
    #[zbus(signal)]
    fn format_changed(&self, summary: &str) -> zbus::Result<()>;

    /// FormatFinished signal
    #[zbus(signal)]
    fn format_finished(&self, status: &str) -> zbus::Result<()>;

    /// SystemChanged signal
    #[zbus(signal)]
    fn system_changed(&self, system: &str) -> zbus::Result<()>;

    /// ProgressChanged signal
    #[zbus(signal)]
    fn progress_changed(&self, progress: &str) -> zbus::Result<()>;

    /// ProgressFinished signal
    #[zbus(signal)]
    fn progress_finished(&self) -> zbus::Result<()>;
}
