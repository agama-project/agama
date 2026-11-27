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

use agama_utils::{api::security::Config, define_message};
use openssl::x509::X509;

define_message!(GetConfig -> Config);
define_message!(SetConfig<T> { config: Option<T> } -> ());

define_message!(
    /// Message to check an SSL certificate.
    CheckCertificate {
        /// X509 certificate.
        certificate: X509,
        /// Certificate name. It is used as the filename (without the extension) when
        /// importing the certificate.
        name: String,
    } -> bool
);

define_message!(
    /// Execute actions at the end of the installation.
    Finish -> ()
);
define_message!(SetLocale { locale: String } -> ());
