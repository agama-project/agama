// Copyright (c) [2024] SUSE LLC
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

use zbus::proxy;
#[proxy(
    interface = "org.opensuse.Agama.Storage1.Job",
    default_service = "org.opensuse.Agama.Storage1",
    default_path = "/org/opensuse/Agama/Storage1/jobs"
)]
trait Job {
    #[zbus(property)]
    fn running(&self) -> zbus::Result<bool>;

    #[zbus(property)]
    fn exit_code(&self) -> zbus::Result<u32>;

    #[zbus(signal)]
    fn finished(&self, exit_code: u32) -> zbus::Result<()>;
}

#[proxy(
    interface = "org.opensuse.Agama.Storage1.DASD.Format",
    default_service = "org.opensuse.Agama.Storage1",
    default_path = "/org/opensuse/Agama/Storage1/jobs/1"
)]
trait FormatJob {
    #[zbus(property)]
    fn summary(&self) -> zbus::Result<std::collections::HashMap<String, (u32, u32, bool)>>;
}
