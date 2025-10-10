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

use tokio::sync::mpsc;

use crate::{model::{license::License, packages::{Repository, ResolvableType}, pattern::Pattern, product::Product, products::ProductsRegistry, registration::{AddonProperties, RegistrationInfo}, software_selection::SoftwareSelection}, service, zypp_server::SoftwareAction};

pub mod conflict;
pub mod license;
pub mod packages;
pub mod pattern;
pub mod product;
pub mod products;
pub mod registration;
pub mod software_selection;

/// Abstract the software-related configuration from the underlying system.
///
/// It offers an API to query and set different software and product elements of a
/// libzypp. This trait can be implemented to replace the real libzypp interaction during
/// tests.
pub trait ModelAdapter: Send + 'static {
    /// List of available patterns.
    fn patterns(&self) -> Result<Vec<Pattern>, service::Error>;

    /// List of available products.
    fn products(&self) -> Result<Vec<Product>, service::Error>;

    /// List of available repositories.
    fn repositories(&self) -> Result<Vec<Repository>, service::Error>;

    /// List of available licenses.
    fn licenses(&self) -> Result<Vec<License>, service::Error>;

    /// List of available addons.
    fn addons(&self) -> Result<Vec<AddonProperties>, service::Error>;

    /// selected product
    fn selected_product(&self) -> Result<Option<String>, service::Error>;

    /// info about registration
    fn registration_info(&self) -> Result<RegistrationInfo, service::Error>;

    /// selects given product
    fn select_product(&self, product_id: &str) -> Result<(), service::Error>;

    /// check if package is available
    fn is_package_available(&self, tag: String) -> Result<bool, service::Error>;

    /// check if package is selected for installation
    fn is_package_selected(&self, tag: String) -> Result<bool, service::Error>;

    /// Gets resolvables set for given combination of id, type and optional flag
    fn get_resolvables(
        &self,
        id: &str,
        r#type: ResolvableType,
        optional: bool,
    ) -> Result<Vec<String>, service::Error>;

    /// Sets resolvables set for given combination of id, type and optional flag
    fn set_resolvables(
        &self,
        id: &str,
        r#type: ResolvableType,
        resolvables: &[&str],
        optional: bool,
    ) -> Result<(), service::Error>;

    /// Probes system and updates info about it.
    fn probe(&self) -> Result<(), service::Error>;

    /// install rpms to target system
    fn install(&self) -> Result<bool, service::Error>;

    /// Finalizes system like disabling local repositories
    fn finish(&self) -> Result<(), service::Error>;
}

/// [ModelAdapter] implementation for libzypp systems.
pub struct Model {
    zypp_sender: mpsc::UnboundedSender<SoftwareAction>,
    products: ProductsRegistry,
    // FIXME: what about having a SoftwareServiceState to keep business logic state?
    selected_product: Option<String>,
    software_selection: SoftwareSelection,
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    pub fn new(zypp_sender: mpsc::UnboundedSender<SoftwareAction>) -> Result<Self, service::Error> {
        Self {
            zypp_sender,
            products: ProductsRegistry::load(),
            selected_product: None,
            software_selection: SoftwareSelection::default(),
        }
    }
}

impl ModelAdapter for Model { 
    fn patterns(&self) -> Result<Vec<Pattern>, service::Error> {

    }
    
    fn products(&self) -> Result<Vec<Product>, service::Error> {
        todo!()
    }
    
    fn select_product(&self, product_id: &str) -> Result<(), service::Error> {
        todo!()
    }
    
    fn is_package_available(&self, tag: String) -> Result<bool, service::Error> {
        todo!()
    }
    
    fn is_package_selected(&self, tag: String) -> Result<bool, service::Error> {
        todo!()
    }
    
    fn get_resolvables(
        &self,
        id: &str,
        r#type: ResolvableType,
        optional: bool,
    ) -> Result<Vec<String>, service::Error> {
        todo!()
    }
    
    fn set_resolvables(
        &self,
        id: &str,
        r#type: ResolvableType,
        resolvables: &[&str],
        optional: bool,
    ) -> Result<(), service::Error> {
        todo!()
    }
    
    fn probe(&self) -> Result<(), service::Error> {
        todo!()
    }
    
    fn finish(&self) -> Result<(), service::Error> {
        todo!()
    }
    
    fn install(&self) -> Result<bool, service::Error> {
        todo!()
    }
    
    fn repositories(&self) -> Result<Vec<Repository>, service::Error> {
        todo!()
    }
    
    fn licenses(&self) -> Result<Vec<License>, service::Error> {
        todo!()
    }
    
    fn addons(&self) -> Result<Vec<AddonProperties>, service::Error> {
        todo!()
    }
    
    fn selected_product(&self) -> Result<Option<String>> {
        todo!()
    }
    
    fn registration_info(&self) -> Result<RegistrationInfo> {
        todo!()
    }
}
