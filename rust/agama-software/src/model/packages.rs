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

// Re-export types from agama-utils
pub use agama_utils::ResolvableType;

/// Extension trait to convert ResolvableType to zypp_agama::ResolvableKind
pub trait ResolvableTypeExt {
    fn to_zypp_kind(&self) -> zypp_agama::ResolvableKind;
}

impl ResolvableTypeExt for ResolvableType {
    fn to_zypp_kind(&self) -> zypp_agama::ResolvableKind {
        match self {
            ResolvableType::Package => zypp_agama::ResolvableKind::Package,
            ResolvableType::Product => zypp_agama::ResolvableKind::Product,
            ResolvableType::Pattern => zypp_agama::ResolvableKind::Pattern,
        }
    }
}
