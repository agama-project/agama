/*
 * Copyright (c) [2022-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  List,
  Split,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import ProductOption from "./ProductOption";
import EulaCheckbox from "./EulaCheckbox";
import Text from "~/components/core/Text";
import { defaultOptions } from "./fields";
import { useAppForm } from "~/hooks/form";
import { Mode, Product } from "~/model/system";
import { n_, _ } from "~/i18n";

/**
 * Props for ProductFormSubmitLabel component
 */
type ProductFormSubmitLabelProps = {
  currentProduct?: Product;
  selectedProduct?: Product;
  selectedMode?: Mode;
};

/**
 * Renders the submit button label based on context.
 * Shows "Change to [Product]" or "Select [Product]" depending on whether
 * user is selecting a product for first time or making a change.
 */
const ProductFormSubmitLabel = ({
  currentProduct,
  selectedProduct,
  selectedMode,
}: ProductFormSubmitLabelProps) => {
  const action = currentProduct ? _("Change to %s") : _("Select %s");
  const fallback = currentProduct ? _("Change") : _("Select");

  if (!selectedProduct) {
    return fallback;
  }

  const [labelStart, labelEnd] = action.split("%s");
  const productLabel = selectedMode
    ? `${selectedMode.name} ${selectedProduct.name}`
    : selectedProduct.name;

  return (
    <Text isBold>
      {labelStart} {productLabel} {labelEnd}
    </Text>
  );
};

/**
 * Props for ProductFormSubmitLabelHelp component
 */
type ProductFormSubmitLabelHelpProps = {
  currentProduct?: Product;
  currentModeId?: string;
  selectedProduct?: Product;
  selectedMode?: Mode;
  hasEula: boolean;
  isEulaAccepted: boolean;
};

/**
 * Displays helper text below the submit button explaining why it's disabled.
 * Shows warnings for missing product selection or not accepted license.
 */
const ProductFormSubmitLabelHelp = ({
  currentProduct,
  currentModeId,
  selectedProduct,
  selectedMode,
  hasEula,
  isEulaAccepted,
}: ProductFormSubmitLabelHelpProps) => {
  let text: string;

  if (!selectedProduct) {
    text = _("Select a product to continue.");
  } else if (!isEmpty(selectedProduct.modes) && isEmpty(selectedMode)) {
    text = _("Select a product mode to continue.");
  } else if (hasEula && !isEulaAccepted) {
    text = _("License acceptance is required to continue.");
  } else if (
    currentProduct &&
    (selectedProduct.id !== currentProduct?.id || selectedMode?.id !== currentModeId)
  ) {
    text = _("Changing the product will reset your current settings.");
  } else {
    return;
  }

  return (
    <HelperText>
      <HelperTextItem variant="warning">{text}</HelperTextItem>
    </HelperText>
  );
};

/**
 * Props for ProductFormLabel component
 */
type ProductFormLabelProps = {
  products: Product[];
  currentProduct?: Product;
};

/**
 * Renders the label for the product selection form.
 *
 * Provides clear, actionable labels that reflect what the user needs to do:
 *   - Initial selection: uses "Choose" verb
 *   - Single product scenarios: focuses on mode selection or switching
 *   - Product switching: uses "Switch" verb and prioritizes mode switching
 *     when available
 *
 * Handles proper pluralization for multiple products.
 */
const ProductFormLabel = ({ products, currentProduct }: ProductFormLabelProps) => {
  const singleProductSelection = products.length === 1;
  const availableProductCount = currentProduct ? products.length - 1 : products.length;
  const currentHasModes = currentProduct && !isEmpty(currentProduct.modes);

  if (singleProductSelection) {
    if (currentProduct) {
      return _("Switch to a different mode");
    }

    if (!isEmpty(products[0].modes)) {
      return _("Choose a mode");
    }

    return _("Choose a product");
  }

  if (!currentProduct) {
    return sprintf(
      n_("Choose a product", "Choose from %d available products", availableProductCount),
      availableProductCount,
    );
  }

  if (!currentHasModes) {
    return sprintf(
      n_(
        "Switch to another product",
        "Switch to one of %d available products",
        availableProductCount,
      ),
      availableProductCount,
    );
  }

  return sprintf(
    n_(
      "Switch to a different mode or another product",
      "Switch to a different mode or to one of %d available products",
      availableProductCount,
    ),
    availableProductCount,
  );
};

/**
 * Props for ProductForm component
 */
export type ProductFormProps = {
  products: Product[];
  currentProduct?: Product;
  currentModeId?: Mode["id"];
  onSubmit: (product: Product, mode: string) => void;
  isSubmitted: boolean;
};

/**
 * Form for selecting a product.
 *
 * Manages product selection state, license acceptance, and form validation.
 * Excludes the current product from the list of options.
 */
export default function ProductForm({
  products,
  currentProduct,
  currentModeId,
  isSubmitted,
  onSubmit,
}: ProductFormProps) {
  const form = useAppForm({
    ...defaultOptions,
    onSubmit: ({ value }) => onSubmit(value.selectedProduct, value.selectedMode?.id),
  });

  // Selecting a product resets the pending mode and license acceptance, since
  // both are meaningful only for the product they belong to.
  const selectProduct = (product: Product) => {
    form.setFieldValue("eulaAccepted", false);
    form.setFieldValue("selectedMode", undefined);
    form.setFieldValue("selectedProduct", product);
  };

  return (
    <form.AppForm>
      <Form
        id="productSelectionForm"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        // @ts-expect-error: https://www.codegenes.net/blog/error-when-using-inert-attribute-with-typescript/
        inert={isSubmitted ? "" : undefined}
      >
        <form.Subscribe selector={(s) => s.values}>
          {({ selectedProduct, selectedMode, eulaAccepted }) => {
            const mountEulaCheckbox = selectedProduct && !isEmpty(selectedProduct.license);
            const isSelectionDisabled =
              !selectedProduct ||
              isSubmitted ||
              (mountEulaCheckbox && !eulaAccepted) ||
              (!isEmpty(selectedProduct.modes) && !selectedMode);

            return (
              <>
                <FormGroup
                  role="radiogroup"
                  label={<ProductFormLabel products={products} currentProduct={currentProduct} />}
                >
                  <List isPlain>
                    {products.map((product, index) => {
                      if (product.id === currentProduct?.id && isEmpty(product.modes))
                        return undefined;

                      return (
                        <ProductOption
                          key={index}
                          product={product}
                          currentModeId={currentModeId}
                          isCurrent={currentProduct?.id === product.id}
                          isChecked={selectedProduct?.id === product.id}
                          selectedModeId={selectedMode?.id}
                          onChange={() => selectProduct(product)}
                          onModeChange={(mode) => form.setFieldValue("selectedMode", mode)}
                        />
                      );
                    })}
                  </List>
                </FormGroup>
                <Stack hasGutter>
                  {mountEulaCheckbox && (
                    <StackItem>
                      <EulaCheckbox
                        product={selectedProduct}
                        isChecked={eulaAccepted}
                        onChange={(accepted) => form.setFieldValue("eulaAccepted", accepted)}
                      />
                    </StackItem>
                  )}
                  <StackItem>
                    <Split hasGutter>
                      <form.SubmitButton
                        isDisabled={isSelectionDisabled}
                        isLoading={isSubmitted}
                        variant={isSubmitted ? "secondary" : "primary"}
                        style={{
                          maxInlineSize: "50dvw",
                          overflow: "hidden",
                          textWrap: "balance",
                          textAlign: "center",
                        }}
                      >
                        <ProductFormSubmitLabel
                          currentProduct={currentProduct}
                          selectedProduct={selectedProduct}
                          selectedMode={selectedMode}
                        />
                      </form.SubmitButton>
                      {currentProduct && !isSubmitted && <form.CancelButton />}
                    </Split>
                  </StackItem>
                  <StackItem>
                    <ProductFormSubmitLabelHelp
                      currentProduct={currentProduct}
                      currentModeId={currentModeId}
                      selectedProduct={selectedProduct}
                      selectedMode={selectedMode}
                      hasEula={mountEulaCheckbox}
                      isEulaAccepted={eulaAccepted}
                    />
                  </StackItem>
                </Stack>
              </>
            );
          }}
        </form.Subscribe>
      </Form>
    </form.AppForm>
  );
}
