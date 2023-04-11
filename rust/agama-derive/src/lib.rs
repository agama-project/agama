use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Fields};

#[derive(Debug, Clone, Copy, PartialEq)]
enum SettingKind {
    Scalar,
    Collection,
}

/// Represents a setting and its configuration
#[derive(Debug, Clone)]
struct SettingField {
    /// Setting ident
    pub ident: syn::Ident,
    /// Setting kind (scalar, collection, struct).
    pub kind: SettingKind,
}

/// List of setting fields
struct SettingFieldsList(Vec<SettingField>);

impl SettingFieldsList {
    pub fn by_type(&self, kind: SettingKind) -> Vec<&SettingField> {
        self.0.iter().filter(|f| f.kind == kind).collect()
    }
}

/// Derive Settings, typically for a FooSettings struct.
/// (see agama_lib::settings::Settings but I cannot link to it without a circular dependency)
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

    let scalar_fields = settings.by_type(SettingKind::Scalar);
    let set_fn = expand_set_fn(&scalar_fields);
    let merge_fn = expand_merge_fn(&scalar_fields);

    let collection_fields = settings.by_type(SettingKind::Collection);
    let add_fn = expand_add_fn(&collection_fields);

    let name = input.ident;
    let expanded = quote! {
        impl Settings for #name {
            #set_fn
            #add_fn
            #merge_fn
        }
    };

    expanded.into()
}

fn expand_set_fn(settings: &Vec<&SettingField>) -> TokenStream2 {
    if settings.is_empty() {
        return quote! {};
    }

    let field_name = settings.iter().map(|s| s.ident.clone());
    quote! {
        fn set(&mut self, attr: &str, value: crate::settings::SettingValue) -> Result<(), crate::settings::SettingsError> {
            match attr {
                #(stringify!(#field_name) => self.#field_name = value.try_into()?,)*
                _ => return Err(SettingsError::UnknownAttribute(attr.to_string()))
            };
            Ok(())
        }
    }
}

fn expand_merge_fn(settings: &Vec<&SettingField>) -> TokenStream2 {
    if settings.is_empty() {
        return quote! {};
    }

    let field_name = settings.iter().map(|s| s.ident.clone());
    quote! {
        fn merge(&mut self, other: &Self)
        where
            Self: Sized,
        {
            #(if let Some(value) = &other.#field_name {
                self.#field_name = Some(value.clone())
              })*
        }
    }
}

fn expand_add_fn(settings: &Vec<&SettingField>) -> TokenStream2 {
    if settings.is_empty() {
        return quote! {};
    }

    let field_name = settings.iter().map(|s| s.ident.clone());
    quote! {
        fn add(&mut self, attr: &str, value: SettingObject) -> Result<(), crate::settings::SettingsError> {
            match attr {
                #(stringify!(#field_name) => self.#field_name.push(value.try_into()?),)*
                _ => return Err(SettingsError::UnknownCollection(attr.to_string()))
            };
            Ok(())
        }
    }
}

// Extracts information about the settings fields
fn parse_setting_fields(fields: Vec<&syn::Field>) -> SettingFieldsList {
    let mut settings = vec![];
    for field in fields {
        let mut setting = SettingField {
            ident: field.ident.clone().expect("to find a field ident"),
            kind: SettingKind::Scalar,
        };

        for attr in &field.attrs {
            if !attr.path().is_ident("settings") {
                continue;
            }
            attr.parse_nested_meta(|meta| {
                if meta.path.is_ident("collection") {
                    setting.kind = SettingKind::Collection;
                };

                Ok(())
            })
            .expect("settings arguments do not follow the expected structure");
        }
        settings.push(setting);
    }
    SettingFieldsList(settings)
}
