// Copyright (c) [2025-2026] SUSE LLC
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

use crate::service;
use agama_utils::{
    api::bootloader::{Config, Proposal},
    define_message, BoxFuture,
};
use serde_json::Value;

define_message!(GetConfig -> Config);
define_message!(GetProposal -> Option<Proposal>);
define_message!(GetSystem -> Option<Value>);
define_message!(SetConfig<T> { config: Option<T> } -> BoxFuture<Result<(), service::Error>>);
define_message!(SetKernelArg { id: String, value: String } -> ());
define_message!(SetLocale { locale: String } -> ());
