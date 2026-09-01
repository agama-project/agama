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

import React, { useDeferredValue, useEffect, useState } from "react";
import { isEmpty } from "radashi";
import {
  Card,
  CardBody,
  CardTitle,
  Content,
  Divider,
  Flex,
  Grid,
  GridItem,
  Stack,
  Title,
} from "@patternfly/react-core";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { SubtleContent } from "~/components/core";
import Page from "~/components/layout/Page";
import ProductLogo from "~/components/product/ProductLogo";
import LicenseButton from "~/components/product/LicenseButton";
import ProductForm from "~/components/product/product-selection-form/Form";
import { patchConfig, putConfig } from "~/api";
import { useProduct, useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { ROOT } from "~/routes/paths";
import { Mode, Product } from "~/model/system";
import { n_, _ } from "~/i18n";

/**
 * Props for CurrentProductInfo component
 */
type CurrentProductInfoProps = {
  /** The currently configured product to display */
  product?: Product;
  /** The selected mode */
  modeId?: string;
};

/**
 * Props for components that need products list and current product
 */
type ProductSelectionContextProps = {
  /** List of all available products */
  products: Product[];
  /** The product currently configured in the system */
  currentProduct?: Product;
};

/**
 * Card displaying information about the currently selected product.
 *
 * Shows product name, description, and a link to view the license if applicable.
 */
const CurrentProductInfo = ({ product, modeId }: CurrentProductInfoProps) => {
  if (!product) return;

  let mode: Mode;
  if (modeId) {
    mode = product.modes.find((m) => m.id === modeId);
  }

  return (
    <Card variant="secondary" component="section" className="sticky-top">
      <CardTitle component="h2">{_("Current selection")}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <Title headingLevel="h3">
            <ProductLogo product={product} width="var(--agm-t--logo--size--inline, 2em)" />{" "}
            {product.name}
          </Title>
          <Divider />
          <SubtleContent>{product.description}</SubtleContent>

          {mode && (
            <>
              <Title headingLevel="h3">{mode.name}</Title>

              <Divider />
              <SubtleContent>{mode.description}</SubtleContent>
            </>
          )}

          {product.license && (
            <LicenseButton product={product} variant="secondary" isInline>
              {_("View license")}
            </LicenseButton>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

/**
 * Renders the page title for the product selection screen.
 *
 * Provides context-aware titles based on the selection scenario.
 */
const ProductSelectionTitle = ({ products, currentProduct }: ProductSelectionContextProps) => {
  const singleProductSelection = products.length === 1;
  const currentHasModes = currentProduct && !isEmpty(currentProduct.modes);

  if (singleProductSelection) {
    if (currentProduct) {
      return _("Change mode");
    }
    if (!isEmpty(products[0].modes)) {
      return _("Select a mode");
    }
    return _("Select a product");
  }

  if (!currentProduct) {
    return _("Select a product");
  }

  if (currentHasModes) {
    return _("Change product or mode");
  }

  return _("Change product");
};

/**
 * Renders introductory text guiding the user through the selection process.
 *
 * Adapts the message based on amount of products available
 *   - Single product with modes: prompts to select a mode
 *   - Single product without modes: prompts to confirm selection
 *   - Multiple products: guides to select and confirm (with plural handling)
 */
const ProductSelectionIntro = ({ products, currentProduct }: ProductSelectionContextProps) => {
  const singleProductSelection = products.length === 1;

  if (singleProductSelection) {
    if (!isEmpty(products[0].modes)) {
      return _("Select a mode and confirm your choice.");
    }
    return _("Confirm the product selection.");
  }

  const availableProductCount = currentProduct ? products.length - 1 : products.length;

  return n_(
    "Select a product and confirm your choice.",
    "Select a product and confirm your choice at the end of the list.",
    availableProductCount,
  );
};

/**
 * Content component for the product selection page.
 *
 * Handles the product selection workflow including:
 *   - Displaying available products.
 *   - Managing selection and submission state.
 *   - Navigating after successful product configuration.
 *   - Showing current product information.
 */
const ProductSelectionContent = () => {
  const navigate = useNavigate();
  const product = useProduct();
  const { products } = useSystem();
  const currentProduct = useProductInfo();
  const [submittedSelection, setSubmmitedSelection] = useState<Product>();
  const [isSubmitted, setIsSubmmited] = useState(false);
  const isWaiting = useDeferredValue(isSubmitted);

  useEffect(() => {
    if (!isSubmitted) return;

    if (currentProduct?.id === submittedSelection?.id) {
      navigate(ROOT.root);
    }
  }, [navigate, isSubmitted, currentProduct, submittedSelection]);

  const onSubmit = async (selectedProduct: Product, selectedMode: string) => {
    setIsSubmmited(true);
    setSubmmitedSelection(selectedProduct);
    const productConfig = { product: { id: selectedProduct.id, mode: selectedMode } };
    if (currentProduct) {
      // Use PUT to reset the config when changing product (bsc#1264438)
      putConfig(productConfig);
    } else {
      // Use PATCH to preserve initial settings when no product was selected yet
      patchConfig(productConfig);
    }
  };

  return (
    <Page
      showL10nValues={!currentProduct}
      breadcrumbs={[
        { label: <ProductSelectionTitle products={products} currentProduct={currentProduct} /> },
      ]}
    >
      <Page.Content>
        <Flex gap={{ default: "gapXs" }} direction={{ default: "column" }}>
          <Content isEditorial>
            <ProductSelectionIntro products={products} currentProduct={currentProduct} />
          </Content>
          {currentProduct && (
            <SubtleContent>
              {
                // TRANSLATORS: hint shown when changing the already selected
                // product, explaining that the current configuration is lost.
                _(
                  "The current configuration will be discarded to apply the default settings of the new product.",
                )
              }
            </SubtleContent>
          )}
        </Flex>
        <Divider />
        <Grid hasGutter>
          <GridItem sm={12} md={8} order={{ default: "1", md: "0" }}>
            <ProductForm
              products={products}
              currentProduct={currentProduct}
              currentModeId={product?.mode}
              isSubmitted={isWaiting}
              onSubmit={onSubmit}
            />
          </GridItem>
          <GridItem sm={12} md={4} order={{ default: "0", md: "1" }}>
            {!isWaiting && <CurrentProductInfo product={currentProduct} modeId={product?.mode} />}
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
};

/**
 * Main page component for product selection.
 *
 * Redirects to root if:
 *   - the system is already registered.
 *   - the product is already selected and the UI get into this page automatically
 *     (the query param "byUser" is not set). See bsc#1260465.
 * Otherwise, renders the product selection interface allowing users to:
 *   - Choose from available products
 *   - View current product information (when changing products)
 */
export default function ProductSelectionPage() {
  const currentProduct = useProductInfo();
  const { registration } = useSystemSoftware();
  const [searchParams] = useSearchParams();

  const redirectOnProduct = currentProduct?.id && searchParams.get("byUser") === null;
  if (registration || redirectOnProduct) return <Navigate to={ROOT.root} />;

  return <ProductSelectionContent />;
}
