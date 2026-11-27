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

use agama_utils::{api::proxy::Config, define_message};

define_message!(GetSystem -> Option<Config>);
define_message!(GetConfig -> Option<Config>);
define_message!(SetConfig<T> { config: Option<T> } -> ());

define_message!(
    /// Execute actions at the end of the installation.
    Finish -> ()
);
define_message!(SetLocale { locale: String } -> ());
