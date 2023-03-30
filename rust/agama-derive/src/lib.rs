use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Fields, Ident};

/// Derive Settings, typically for a FooSettings struct.
/// (see dinstaller_lib::settings::Settings but I cannot link to it without a circular dependency)
#[proc_macro_derive(Settings, attributes(collection_setting))]
pub fn agama_attributes_derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let fields = match &input.data {
        syn::Data::Struct(syn::DataStruct {
            fields: Fields::Named(fields),
            ..
        }) => &fields.named,
        _ => panic!("only structs are supported"),
    };

    let (collection, scalar): (Vec<_>, Vec<_>) = fields.clone().into_iter().partition(|f| {
        f.attrs
            .iter()
            .any(|a| a.path.is_ident("collection_setting"))
    });

    let scalar_field_names: Vec<Ident> =
        scalar.into_iter().filter_map(|field| field.ident).collect();

    let set_fn = expand_set_fn(&scalar_field_names);
    let merge_fn = expand_merge_fn(&scalar_field_names);

    let collection_field_names: Vec<Ident> = collection
        .into_iter()
        .filter_map(|field| field.ident)
        .collect();
    let add_fn = expand_add_fn(&collection_field_names);

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

fn expand_set_fn(field_name: &Vec<Ident>) -> TokenStream2 {
    if field_name.is_empty() {
        return quote! {};
    }

    quote! {
        fn set(&mut self, attr: &str, value: SettingValue) -> Result<(), &'static str> {
            match attr {
                #(stringify!(#field_name) => self.#field_name = value.try_into()?,)*
                _ => return Err("unknown attribute")
            };
            Ok(())
        }
    }
}

fn expand_merge_fn(field_name: &Vec<Ident>) -> TokenStream2 {
    if field_name.is_empty() {
        return quote! {};
    }

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

fn expand_add_fn(field_name: &Vec<Ident>) -> TokenStream2 {
    if field_name.is_empty() {
        return quote! {};
    }

    quote! {
        fn add(&mut self, attr: &str, value: SettingObject) -> Result<(), &'static str> {
            match attr {
                #(stringify!(#field_name) => self.#field_name.push(value.try_into()?),)*
                _ => return Err("unknown attribute")
            };
            Ok(())
        }
    }
}
