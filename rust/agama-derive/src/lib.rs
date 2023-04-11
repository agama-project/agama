use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Fields};

#[derive(Debug, Clone)]
enum SettingKind {
    Scalar,
    Collection,
}

#[derive(Debug, Clone)]
struct SettingField {
    ident: syn::Ident,
    kind: SettingKind,
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

    let scalar_fields: Vec<SettingField> = settings
        .clone()
        .into_iter()
        .filter(|s| matches!(s.kind, SettingKind::Scalar))
        .collect();

    let set_fn = expand_set_fn(&scalar_fields);
    let merge_fn = expand_merge_fn(&scalar_fields);

    let collection_fields: Vec<SettingField> = settings
        .clone()
        .into_iter()
        .filter(|s| matches!(s.kind, SettingKind::Collection))
        .collect();
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

fn expand_set_fn(settings: &Vec<SettingField>) -> TokenStream2 {
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

fn expand_merge_fn(settings: &Vec<SettingField>) -> TokenStream2 {
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

fn expand_add_fn(settings: &Vec<SettingField>) -> TokenStream2 {
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
fn parse_setting_fields(fields: Vec<&syn::Field>) -> Vec<SettingField> {
    let mut settings = vec![];
    for field in fields {
        let mut setting = SettingField {
            ident: field.ident.clone().expect("could not find an ident"),
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
            .expect("wrong arguments to the settings attribute");
        }
        settings.push(setting);
    }
    settings
}
