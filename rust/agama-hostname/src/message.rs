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

use agama_utils::{
    api::hostname::{Config, Proposal, SystemInfo},
    define_message,
};

define_message!(GetSystem -> SystemInfo);
define_message!(SetSystem<T> { config: T } -> ());
define_message!(GetConfig -> Config);
define_message!(SetConfig<T> { config: Option<T> } -> ());
define_message!(GetProposal -> Option<Proposal>);
define_message!(UpdateHostname { name: String } -> ());
define_message!(UpdateStaticHostname { name: String } -> ());
define_message!(Install -> ());
define_message!(SetLocale { locale: String } -> ());
