//! Implements a derive macro to implement the Settings from the `agama_settings` crate.
//!
//! ```no_compile
//! use agama_settings::{Settings, settings::Settings};
//!
//! #[derive(Default, Settings)]
//! struct UserSettings {
//!   name: Option<String>,
//!   enabled: Option<bool>
//! }
//!
//! #[derive(Default, Settings)]
//! struct InstallSettings {
//!   #[settings(nested, alias = "first_user")]
//!   user: Option<UserSettings>,
//!   reboot: Option<bool>
//!   product: Option<String>,
//!   #[settings(collection)]
//!   packages: Vec<String>
//! }
//!
//! ## Supported attributes
//!
//! * `nested`: the field is another struct that implements `Settings`.
//! * `collection`: the attribute is a vector of elements of type T. You might need to implement
//!   `TryFrom<SettingObject> for T` for your custom types.
//! * `flatten`: the field is flatten (in serde jargon).
//! * `alias`: and alternative name for the field. It can be specified several times.
//! ```

use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Fields, LitStr};

#[derive(Debug, Clone, Copy, PartialEq)]
enum SettingKind {
    /// A single value; the default.
    Scalar,
    /// An array of scalars, use `#[settings(collection)]`.
    Collection,
    /// The value is another FooSettings, use `#[settings(nested)]`.
    Nested,
    Ignored,
}

/// Represents a setting and its configuration
#[derive(Debug, Clone)]
struct SettingField {
    /// Setting ident ("A word of Rust code, may be a keyword or variable name").
    pub ident: syn::Ident,
    /// Setting kind (scalar, collection, struct).
    pub kind: SettingKind,
    /// Whether it is a flatten (in serde jargon) value.
    pub flatten: bool,
    /// Aliases for the field (especially useful for flatten fields).
    pub aliases: Vec<String>,
}

impl SettingField {
    pub fn new(ident: syn::Ident) -> Self {
        Self {
            ident,
            kind: SettingKind::Scalar,
            flatten: false,
            aliases: vec![],
        }
    }
}

/// List of setting fields
#[derive(Debug)]
struct SettingFieldsList(Vec<SettingField>);

impl SettingFieldsList {
    pub fn by_type(&self, kind: SettingKind) -> Vec<&SettingField> {
        self.0.iter().filter(|f| f.kind == kind).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    // TODO: implement Iterator?
    pub fn all(&self) -> &Vec<SettingField> {
        &self.0
    }
}

/// Derive Settings, typically for a FooSettings struct.
/// (see the trait agama_settings::settings::Settings but I cannot link to it without a circular dependency)
#[proc_macro_derive(Settings, attributes(settings))]
pub fn agama_attributes_derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let fields = match &input.data {
        syn::Data::Struct(syn::DataStruct {
            fields: Fields::Named(fields),
            ..
        }) => &fields.named,
        _ => panic!("only structs are supported"),
    };

    let fields: Vec<&syn::Field> = fields.iter().collect();
    let settings = parse_setting_fields(fields);

    let set_fn = expand_set_fn(&settings);
    let add_fn = expand_add_fn(&settings);
    let merge_fn = expand_merge_fn(&settings);

    let name = input.ident;
    let expanded = quote! {
        impl agama_settings::settings::Settings for #name {
            #set_fn
            #add_fn
            #merge_fn
        }
    };

    expanded.into()
}

fn expand_set_fn(settings: &SettingFieldsList) -> TokenStream2 {
    let scalar_fields = settings.by_type(SettingKind::Scalar);
    let nested_fields = settings.by_type(SettingKind::Nested);
    if scalar_fields.is_empty() && nested_fields.is_empty() {
        return quote! {};
    }

    let mut scalar_handling = quote! { Ok(()) };
    if !scalar_fields.is_empty() {
        let field_name = scalar_fields.iter().map(|s| s.ident.clone());
        scalar_handling = quote! {
            match attr {
                #(stringify!(#field_name) => self.#field_name = value.try_into().map_err(|e| {
                    agama_settings::SettingsError::UpdateFailed(attr.to_string(), e)
                })?,)*
                _ => return Err(agama_settings::SettingsError::UnknownAttribute(attr.to_string()))
            }
            Ok(())
        }
    }

    let mut nested_handling = quote! {};
    if !nested_fields.is_empty() {
        let field_name = nested_fields.iter().map(|s| s.ident.clone());
        let aliases = quote_fields_aliases(&nested_fields);
        let attr = nested_fields
            .iter()
            .map(|s| if s.flatten { quote!(attr) } else { quote!(id) });
        nested_handling = quote! {
            if let Some((ns, id)) = attr.split_once('.') {
                match ns {
                    #(stringify!(#field_name) #aliases => {
                        let #field_name = self.#field_name.get_or_insert(Default::default());
                        #field_name.set(#attr, value).map_err(|e| e.with_attr(attr))?
                    })*
                    _ => return Err(agama_settings::SettingsError::UnknownAttribute(attr.to_string()))
                }
                return Ok(())
            }
        }
    }

    quote! {
         fn set(&mut self, attr: &str, value: agama_settings::SettingValue) -> Result<(), agama_settings::SettingsError> {
            #nested_handling
            #scalar_handling
         }
    }
}

fn expand_merge_fn(settings: &SettingFieldsList) -> TokenStream2 {
    if settings.is_empty() {
        return quote! {};
    }

    let arms = settings.all().iter().map(|s| {
        let field_name = &s.ident;
        match s.kind {
            SettingKind::Scalar | SettingKind::Ignored => quote! {
                if let Some(value) = &other.#field_name {
                    self.#field_name = Some(value.clone())
                }
            },
            SettingKind::Nested => quote! {
                if let Some(other_value) = &other.#field_name {
                    let nested = self.#field_name.get_or_insert(Default::default());
                    nested.merge(other_value);
                }
            },
            SettingKind::Collection => quote! {
                    self.#field_name = other.#field_name.clone();
            },
        }
    });

    quote! {
        fn merge(&mut self, other: &Self)
        where
            Self: Sized,
        {
            #(#arms)*
        }
    }
}

fn expand_add_fn(settings: &SettingFieldsList) -> TokenStream2 {
    let collection_fields = settings.by_type(SettingKind::Collection);
    let nested_fields = settings.by_type(SettingKind::Nested);
    if collection_fields.is_empty() && nested_fields.is_empty() {
        return quote! {};
    }

    let mut collection_handling = quote! { Ok(()) };
    if !collection_fields.is_empty() {
        let field_name = collection_fields.iter().map(|s| s.ident.clone());
        collection_handling = quote! {
            match attr {
                #(stringify!(#field_name) => {
                    let converted = value.try_into().map_err(|e| {
                        agama_settings::SettingsError::UpdateFailed(attr.to_string(), e)
                    })?;
                    self.#field_name.push(converted)
                },)*
                _ => return Err(agama_settings::SettingsError::UnknownAttribute(attr.to_string()))
            }
            Ok(())
        };
    }

    let mut nested_handling = quote! {};
    if !nested_fields.is_empty() {
        let field_name = nested_fields.iter().map(|s| s.ident.clone());
        nested_handling = quote! {
            if let Some((ns, id)) = attr.split_once('.') {
                match ns {
                    #(stringify!(#field_name) => {
                        let #field_name = self.#field_name.get_or_insert(Default::default());
                        #field_name.add(id, value).map_err(|e| e.with_attr(attr))?
                    })*
                    _ => return Err(agama_settings::SettingsError::UnknownAttribute(attr.to_string()))
                }
                return Ok(())
            }
        }
    }
    quote! {
        fn add(&mut self, attr: &str, value: agama_settings::SettingObject) -> Result<(), agama_settings::SettingsError> {
            #nested_handling
            #collection_handling
        }
    }
}

// Extracts information about the settings fields.
//
// syn::Field is "A field of a struct or enum variant.",
// has .ident .ty(pe) .mutability .vis(ibility)...
fn parse_setting_fields(fields: Vec<&syn::Field>) -> SettingFieldsList {
    let mut settings = vec![];
    for field in fields {
        let ident = field.ident.clone().expect("to find a field ident");
        let mut setting = SettingField::new(ident);
        for attr in &field.attrs {
            if !attr.path().is_ident("settings") {
                continue;
            }

            attr.parse_nested_meta(|meta| {
                if meta.path.is_ident("collection") {
                    setting.kind = SettingKind::Collection;
                };

                if meta.path.is_ident("nested") {
                    setting.kind = SettingKind::Nested;
                }

                if meta.path.is_ident("ignored") {
                    setting.kind = SettingKind::Ignored;
                }

                if meta.path.is_ident("flatten") {
                    setting.flatten = true;
                }

                if meta.path.is_ident("alias") {
                    let value = meta.value()?;
                    let alias: LitStr = value.parse()?;
                    setting.aliases.push(alias.value());
                }

                Ok(())
            })
            .expect("settings arguments do not follow the expected structure");
        }
        settings.push(setting);
    }
    SettingFieldsList(settings)
}

fn quote_fields_aliases(nested_fields: &[&SettingField]) -> Vec<TokenStream2> {
    nested_fields
        .iter()
        .map(|f| {
            let aliases = f.aliases.clone();
            if aliases.is_empty() {
                quote! {}
            } else {
                quote! { #(| #aliases)* }
            }
        })
        .collect()
}
