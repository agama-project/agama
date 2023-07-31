use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Fields};

#[derive(Debug, Clone, Copy, PartialEq)]
enum SettingKind {
    /// A single value; the default.
    Scalar,
    /// An array of scalars, use `#[settings(collection)]`
    Collection,
    /// The value is another FooSettings, use `#[settings(nested)]`
    Nested,
}

/// Represents a setting and its configuration
#[derive(Debug, Clone)]
struct SettingField {
    /// Setting ident ("A word of Rust code, may be a keyword or variable name")
    pub ident: syn::Ident,
    /// Setting kind (scalar, collection, struct).
    pub kind: SettingKind,
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
    if settings.is_empty() {
        return quote! {};
    }

    let mut scalar_handling = quote! {};
    let scalar_fields = settings.by_type(SettingKind::Scalar);
    if !scalar_fields.is_empty() {
        let field_name = scalar_fields.iter().map(|s| s.ident.clone());
        scalar_handling = quote! {
            match attr {
                #(stringify!(#field_name) => self.#field_name = value.try_into()?,)*
                _ => return Err(agama_settings::SettingsError::UnknownAttribute(attr.to_string()))
            }
        }
    }

    let mut nested_handling = quote! {};
    let nested_fields = settings.by_type(SettingKind::Nested);
    if !nested_fields.is_empty() {
        let field_name = nested_fields.iter().map(|s| s.ident.clone());
        nested_handling = quote! {
            if let Some((ns, id)) = attr.split_once('.') {
                match ns {
                    #(stringify!(#field_name) => {
                        let #field_name = self.#field_name.get_or_insert(Default::default());
                        #field_name.set(id, value)?
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
            Ok(())
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
            SettingKind::Scalar => quote! {
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
    if settings.is_empty() {
        return quote! {};
    }

    let mut collection_handling = quote! {};
    let collection_fields = settings.by_type(SettingKind::Collection);
    if !collection_fields.is_empty() {
        let field_name = collection_fields.iter().map(|s| s.ident.clone());
        collection_handling = quote! {
            match attr {
                #(stringify!(#field_name) => self.#field_name.push(value.try_into()?),)*
                _ => return Err(agama_settings::SettingsError::UnknownCollection(attr.to_string()))
            }
        };
    }

    let mut nested_handling = quote! {};
    let nested_fields = settings.by_type(SettingKind::Nested);
    if !nested_fields.is_empty() {
        let field_name = nested_fields.iter().map(|s| s.ident.clone());
        nested_handling = quote! {
            if let Some((ns, id)) = attr.split_once('.') {
                match ns {
                    #(stringify!(#field_name) => {
                        let #field_name = self.#field_name.get_or_insert(Default::default());
                        #field_name.add(id, value)?
                    })*
                    _ => return Err(agama_settings::SettingsError::UnknownAttribute(attr.to_string()))
                }
            }
        }
    }

    quote! {
        fn add(&mut self, attr: &str, value: agama_settings::SettingObject) -> Result<(), agama_settings::SettingsError> {
            #nested_handling
            #collection_handling
            Ok(())
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

                if meta.path.is_ident("nested") {
                    setting.kind = SettingKind::Nested;
                }

                Ok(())
            })
            .expect("settings arguments do not follow the expected structure");
        }
        settings.push(setting);
    }
    SettingFieldsList(settings)
}
