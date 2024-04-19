use std::collections::HashMap;

use crate::error::ServiceError;
use crate::software::proxies::SoftwareProductProxy;
use serde::{Deserialize, Serialize};
use zbus::Connection;

use super::proxies::RegistrationProxy;

/// Represents a software product
#[derive(Default, Debug, Serialize, utoipa::ToSchema)]
pub struct Product {
    /// Product ID (eg., "ALP", "Tumbleweed", etc.)
    pub id: String,
    /// Product name (e.g., "openSUSE Tumbleweed")
    pub name: String,
    /// Product description
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub enum RegistrationRequirement {
    /// Product does not require registration
    NotRequired = 0,
    /// Product has optional registration
    Optional = 1,
    /// It is mandatory to register the product
    Mandatory = 2,
}

impl TryFrom<u32> for RegistrationRequirement {
    type Error = ();

    fn try_from(v: u32) -> Result<Self, Self::Error> {
        match v {
            x if x == RegistrationRequirement::NotRequired as u32 => {
                Ok(RegistrationRequirement::NotRequired)
            }
            x if x == RegistrationRequirement::Optional as u32 => {
                Ok(RegistrationRequirement::Optional)
            }
            x if x == RegistrationRequirement::Mandatory as u32 => {
                Ok(RegistrationRequirement::Mandatory)
            }
            _ => Err(()),
        }
    }
}

/// D-Bus client for the software service
#[derive(Clone)]
pub struct ProductClient<'a> {
    product_proxy: SoftwareProductProxy<'a>,
    registration_proxy: RegistrationProxy<'a>,
}

impl<'a> ProductClient<'a> {
    pub async fn new(connection: Connection) -> Result<ProductClient<'a>, ServiceError> {
        Ok(Self {
            product_proxy: SoftwareProductProxy::new(&connection).await?,
            registration_proxy: RegistrationProxy::new(&connection).await?,
        })
    }

    /// Returns the available products
    pub async fn products(&self) -> Result<Vec<Product>, ServiceError> {
        let products: Vec<Product> = self
            .product_proxy
            .available_products()
            .await?
            .into_iter()
            .map(|(id, name, data)| {
                let description = match data.get("description") {
                    Some(value) => value.try_into().unwrap(),
                    None => "",
                };
                Product {
                    id,
                    name,
                    description: description.to_string(),
                }
            })
            .collect();
        Ok(products)
    }

    /// Returns the id of the selected product to install
    pub async fn product(&self) -> Result<String, ServiceError> {
        Ok(self.product_proxy.selected_product().await?)
    }

    /// Selects the product to install
    pub async fn select_product(&self, product_id: &str) -> Result<(), ServiceError> {
        let result = self.product_proxy.select_product(product_id).await?;

        match result {
            (0, _) => Ok(()),
            (3, description) => {
                let products = self.products().await?;
                let ids: Vec<String> = products.into_iter().map(|p| p.id).collect();
                let error = format!("{0}. Available products: '{1:?}'", description, ids);
                Err(ServiceError::UnsuccessfulAction(error))
            }
            (_, description) => Err(ServiceError::UnsuccessfulAction(description)),
        }
    }

    /// registration code used to register product
    pub async fn registration_code(&self) -> Result<String, ServiceError> {
        Ok(self.registration_proxy.reg_code().await?)
    }

    /// email used to register product
    pub async fn email(&self) -> Result<String, ServiceError> {
        Ok(self.registration_proxy.email().await?)
    }

    pub async fn registration_requirement(&self) -> Result<RegistrationRequirement, ServiceError> {
        let requirement = self.registration_proxy.requirement().await?;
        // unknown number can happen only if we do programmer mistake
        let result: RegistrationRequirement = requirement.try_into().unwrap();
        Ok(result)
    }

    /// register product
    pub async fn register(&self, code: &str, email: &str) -> Result<(u32, String), ServiceError> {
        let mut options: HashMap<&str, zbus::zvariant::Value> = HashMap::new();
        if !email.is_empty() {
            options.insert("Email", zbus::zvariant::Value::new(email));
        }
        Ok(self.registration_proxy.register(code, options).await?)
    }

    /// de-register product
    pub async fn deregister(&self) -> Result<(u32, String), ServiceError> {
        Ok(self.registration_proxy.deregister().await?)
    }
}
