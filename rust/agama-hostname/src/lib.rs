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

//! This crate implements the support for localization handling in Agama.
//! It takes care of setting the locale, keymap and timezone for Agama itself
//! and the target system.
//!
//! From a technical point of view, it includes:
//!
//! * The [UserConfig] struct that defines the settings the user can
//!   alter for the target system.
//! * The [Proposal] struct that describes how the system will look like after
//!   the installation.
//! * The [SystemInfo] which includes information about the system
//!   where Agama is running.
//! * An [specific event type](Event) for localization-related events.
//!
//! The service can be started by calling the [start_service] function, which
//! returns a [agama_utils::actors::ActorHandler] to interact with the system.

pub mod service;
pub use service::{Service, Starter};

mod dbus;
pub mod message;
mod model;
pub use model::{Model, ModelAdapter};
mod monitor;
