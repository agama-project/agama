use std::collections::HashMap;

use crate::error::ServiceError;
use crate::software::proxies::SoftwareProductProxy;
use serde::Serialize;
use zbus::Connection;

use super::proxies::RegistrationProxy;

/// Represents a software product
#[derive(Debug, Serialize)]
pub struct Product {
    /// Product ID (eg., "ALP", "Tumbleweed", etc.)
    pub id: String,
    /// Product name (e.g., "openSUSE Tumbleweed")
    pub name: String,
    /// Product description
    pub description: String,
}

/// D-Bus client for the software service
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

    /// Returns the selected product to install
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

    /// register product
    pub async fn register(&self, code: &str, _email: &str) -> Result<(), ServiceError> {
        // TODO: handle email
        self.registration_proxy
            .register(code, HashMap::new())
            .await?;
        Ok(())
    }
}
