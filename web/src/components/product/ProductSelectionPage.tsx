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
import { sprintf } from "sprintf-js";
import {
  Button,
  ButtonProps,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Content,
  Divider,
  ExpandableSection,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Label,
  List,
  ListItem,
  Radio,
  Split,
  Stack,
  StackItem,
  Title,
} from "@patternfly/react-core";
import { Navigate, useNavigate } from "react-router";
import { InstallerL10nOptions, Link, Page, SubtleContent } from "~/components/core";
import ProductLogo from "~/components/product/ProductLogo";
import LicenseDialog from "~/components/product/LicenseDialog";
import Text from "~/components/core/Text";
import { patchConfig } from "~/api";
import { useProduct, useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { ROOT } from "~/routes/paths";
import { Mode, Product } from "~/model/system";
import { n_, _ } from "~/i18n";

import pfTextStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { useInstallerL10n } from "~/context/installerL10n";

/**
 * Props for ProductFormProductOption component
 */
type ProductFormProductOptionProps = {
  /** The product to display as an option */
  product: Product;
  /** Whether this product is currently configured in the system */
  isCurrent: boolean;
  /** Whether this product option is currently selected by the user UI */
  isChecked: boolean;
  /** The id of the product mode currently selected by the user in the UI */
  selectedModeId?: Mode["id"];
  /** The id of the product mode currently configured in the system, if any */
  currentModeId?: Mode["id"];
  /** Callback fired when the product is selected */
  onChange: () => void;
  /** Callback fired when the mode is changed */
  onModeChange: (mode: Mode) => void;
};

/**
 * Renders a single product option as a radio button with expandable details.
 */
const ProductFormProductOption = ({
  product,
  currentModeId,
  selectedModeId,
  isCurrent,
  isChecked,
  onChange,
  onModeChange,
}: ProductFormProductOptionProps) => {
  const { loadedLanguage: currentLocale } = useInstallerL10n();
  const detailsId = `${product.id}-details`;

  const translatedDescription =
    product.translations?.description[currentLocale] || product.description;

  // Filter out the currently selected mode if this is the current product
  const availableModes = product.modes?.filter((mode) =>
    isCurrent ? mode.id !== currentModeId : true,
  );

  // Count of modes to display in the label
  const modesCount = availableModes?.length || 0;
  const modesLabel = isCurrent
    ? sprintf(n_("%d other mode available", "%d other modes available", modesCount), modesCount)
    : sprintf(n_("%d mode available", "%d modes available", modesCount), modesCount);

  return (
    <ListItem aria-label={product.name}>
      <Card isPlain={!isChecked} isCompact variant={isChecked ? "secondary" : "default"}>
        <CardBody>
          <Flex flexWrap={{ default: "nowrap" }} alignItems={{ default: "alignItemsFlexStart" }}>
            <FlexItem>
              <Radio
                id={product.id}
                name="product"
                isChecked={isChecked}
                onChange={onChange}
                aria-details={detailsId}
                label={
                  <Text isBold className={pfTextStyles.fontSizeLg}>
                    <ProductLogo product={product} width="2em" /> {product.name}
                  </Text>
                }
                body={
                  <Stack hasGutter id={detailsId}>
                    {(product.license || product.modes) && (
                      <Split hasGutter>
                        {product.license && (
                          <Label variant="outline" isCompact>
                            <Text component="small">{_("License acceptance required")}</Text>
                          </Label>
                        )}
                        {!isEmpty(availableModes) && (
                          <Label variant="outline" isCompact>
                            <Text component="small">{modesLabel}</Text>
                          </Label>
                        )}
                      </Split>
                    )}

                    <ExpandableSection
                      variant="truncate"
                      truncateMaxLines={2}
                      toggleTextCollapsed={_("Show more")}
                      toggleTextExpanded={_("Show less")}
                    >
                      <SubtleContent>{translatedDescription}</SubtleContent>
                    </ExpandableSection>
                    {isChecked && availableModes && (
                      <Split hasGutter>
                        {availableModes.map((mode) => {
                          const translatedModeName =
                            product.translations?.mode?.[mode.id]?.name[currentLocale] || mode.name;
                          const translatedModeDescription =
                            product.translations?.mode?.[mode.id]?.description[currentLocale] ||
                            mode.description;
                          return (
                            <FlexItem key={mode.id}>
                              <Radio
                                key={mode.id}
                                id={mode.id}
                                name="mode"
                                isChecked={mode.id === selectedModeId}
                                onChange={() => onModeChange(mode)}
                                label={<Text isBold>{translatedModeName}</Text>}
                                description={translatedModeDescription}
                              />
                            </FlexItem>
                          );
                        })}
                      </Split>
                    )}
                  </Stack>
                }
              />
            </FlexItem>
          </Flex>
        </CardBody>
      </Card>
    </ListItem>
  );
};

/**
 * Props for LicenseButton component
 */
type LicenseButtonProps = Omit<ButtonProps, "onClick"> & {
  /** The product whose license will be displayed */
  product: Product;
};

/**
 * Button that opens a license dialog when clicked.
 */
const LicenseButton = ({ product, children, ...props }: LicenseButtonProps) => {
  const [showEula, setShowEula] = useState(false);

  const open = () => setShowEula(true);
  const close = () => setShowEula(false);

  return (
    <>
      <Button {...props} onClick={open}>
        {children}
      </Button>
      {showEula && <LicenseDialog product={product} onClose={close} />}
    </>
  );
};

/**
 * Props for EulaCheckbox component
 */
type EulaCheckboxProps = {
  /** The product whose license is being accepted */
  product: Product;
  /** Callback fired when checkbox state changes */
  onChange: (accepted: boolean) => void;
  /** Whether the checkbox is currently checked (i.e., license accepted) */
  isChecked: boolean;
};

/**
 * Checkbox for accepting a product's license agreement.
 * Includes a link to view the full license text.
 */
const EulaCheckbox = ({ product, onChange, isChecked }: EulaCheckboxProps) => {
  const [eulaTextStart, eulaTextLink, eulaTextEnd] = sprintf(
    // TRANSLATORS: Text used for the license acceptance checkbox. %s will be
    // replaced with the product name and the text in the square brackets [] is
    // used for the link to show the license, please keep the brackets.
    _("I have read and accept the [license] for %s"),
    product?.name,
  ).split(/[[\]]/);

  return (
    <>
      <Checkbox
        isChecked={isChecked}
        onChange={(_, accepted) => onChange(accepted)}
        id="license-acceptance"
        label={
          <>
            {eulaTextStart}{" "}
            <LicenseButton product={product} variant="link" isInline>
              {eulaTextLink}
            </LicenseButton>{" "}
            {eulaTextEnd}
          </>
        }
      />
    </>
  );
};
/**
 * Props for ProductFormSubmitLabel component
 */
type ProductFormSubmitLabelProps = {
  /** The product currently configured in the system */
  currentProduct?: Product;
  /** The product selected by the user in the UI (not yet confirmed) */
  selectedProduct?: Product;
  /** The product mode selected by the user in the UI (not yet confirmed) */
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
  /** The product selected by the user */
  selectedProduct?: Product;
  /** The product mode selected by the user */
  selectedMode?: Mode;
  /** Whether the selected product requires license acceptance */
  hasEula: boolean;
  /** Whether the user has accepted the license */
  isEulaAccepted: boolean;
};

/**
 * Displays helper text below the submit button explaining why it's disabled.
 * Shows warnings for missing product selection or not accepted license.
 */
const ProductFormSubmitLabelHelp = ({
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
 * Props for ProductForm component
 */
type ProductFormProps = {
  /** List of all available products */
  products: Product[];
  /** The product currently configured in the system */
  currentProduct?: Product;
  /** The id of the product mode currently configured in the system */
  currentModeId?: Mode["id"];
  /** Callback fired when the form is submitted with a selected product */
  onSubmit: (product: Product, mode: string) => void;
  /** Whether the form was already submitted */
  isSubmitted: boolean;
};

type ProductSelectionContextProps = {
  /** List of all available products */
  products: Product[];
  /** The product currently configured in the system */
  currentProduct?: Product;
};

/**
 * Renders the label for the product selection form.
 *
 * Provides clear, actionable labels that reflect what the user needs to do
 *   - Initial selection: uses "Choose" verb
 *   - Single product scenarios: focuses on mode selection or switching
 *   - Product switching: uses "Switch" verb and prioritizes mode switching
 *     when available
 *
 * Handles proper pluralization for multiple products.
 */
const ProductFormLabel = ({ products, currentProduct }: ProductSelectionContextProps) => {
  const singleProductSelection = products.length === 1;
  const availableProductCount = currentProduct ? products.length - 1 : products.length;
  const currentHasModes = currentProduct && !isEmpty(currentProduct.modes);

  // Single product scenarios
  if (singleProductSelection) {
    // Can only switch modes (product already selected)
    if (currentProduct) {
      return _("Switch to a different mode");
    }

    // Need to choose a mode (initial selection)
    if (!isEmpty(products[0].modes)) {
      return _("Choose a mode");
    }

    // Single product without modes.
    // FIXME: shouldn't happen, temporary fallback
    return _("Choose a product");
  }

  // No product selected yet (multiple products available)
  if (!currentProduct) {
    return sprintf(
      n_("Choose a product", "Choose from %d available products", availableProductCount),
      availableProductCount,
    );
  }

  // Switching from existing product (without modes)
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

  // Switching from existing product (with modes)
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
 * Form for selecting a product.
 *
 * Manages product selection state, license acceptance, and form validation.
 * Excludes the current product from the list of options.
 *
 * TODO: use a reducer instead of bunch of isolated state pieces
 */
const ProductForm = ({
  products,
  currentProduct,
  currentModeId,
  isSubmitted,
  onSubmit,
}: ProductFormProps) => {
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedMode, setSelectedMode] = useState<Mode>();
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const mountEulaCheckbox = selectedProduct && !isEmpty(selectedProduct.license);
  const isSelectionDisabled =
    !selectedProduct ||
    isSubmitted ||
    (mountEulaCheckbox && !eulaAccepted) ||
    (!isEmpty(selectedProduct.modes) && !selectedMode);

  const onProductSelectionChange = (product) => {
    setEulaAccepted(false);
    setSelectedMode(undefined);
    setSelectedProduct(product);
  };

  const onFormSubmission = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit(selectedProduct, selectedMode?.id);
  };

  return (
    <Form
      id="productSelectionForm"
      onSubmit={onFormSubmission}
      // @ts-expect-error: https://www.codegenes.net/blog/error-when-using-inert-attribute-with-typescript/
      inert={isSubmitted ? "" : undefined}
    >
      <FormGroup
        role="radiogroup"
        label={<ProductFormLabel products={products} currentProduct={currentProduct} />}
      >
        <List isPlain>
          {products.map((product, index) => {
            // FIXME: check what happens if a product offers only one mode ;/
            if (product.id === currentProduct?.id && isEmpty(product.modes)) return undefined;

            return (
              <ProductFormProductOption
                key={index}
                product={product}
                currentModeId={currentModeId}
                isCurrent={currentProduct?.id === product.id}
                isChecked={selectedProduct?.id === product.id}
                selectedModeId={selectedMode?.id}
                onChange={() => onProductSelectionChange(product)}
                onModeChange={setSelectedMode}
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
              onChange={setEulaAccepted}
            />
          </StackItem>
        )}
        <StackItem>
          <Split hasGutter>
            <Page.Submit
              size="lg"
              form="productSelectionForm"
              isDisabled={isSelectionDisabled}
              isLoading={isSubmitted}
              variant={isSubmitted ? "secondary" : "primary"}
              style={{
                maxInlineSize: "50dvw",
                overflow: "hidden",
                textWrap: "balance",
                textAlign: "start",
              }}
            >
              <ProductFormSubmitLabel
                currentProduct={currentProduct}
                selectedProduct={selectedProduct}
                selectedMode={selectedMode}
              />
            </Page.Submit>
            {currentProduct && !isSubmitted && (
              <Link to={ROOT.overview} size="lg" variant="link">
                {_("Cancel")}
              </Link>
            )}
          </Split>
        </StackItem>
        <StackItem>
          <ProductFormSubmitLabelHelp
            selectedProduct={selectedProduct}
            selectedMode={selectedMode}
            hasEula={mountEulaCheckbox}
            isEulaAccepted={eulaAccepted}
          />
        </StackItem>
      </Stack>
    </Form>
  );
};

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
 * Card displaying information about the currently selected product.
 *
 * Shows product name, description, and a link to view the license if applicable.
 */
const CurrentProductInfo = ({ product, modeId }: CurrentProductInfoProps) => {
  const { loadedLanguage: currentLocale } = useInstallerL10n();
  if (!product) return;

  const translatedDescription =
    product.translations?.description[currentLocale] || product.description;

  let mode: Mode;
  let translatedModeName: string;
  let translatedModeDescription: string;
  if (modeId) {
    mode = product.modes.find((m) => m.id === modeId);
    translatedModeName = product.translations?.mode?.[modeId]?.name[currentLocale] || mode?.name;
    translatedModeDescription =
      product.translations?.mode?.[modeId]?.description[currentLocale] || mode?.description;
  }

  return (
    <Card variant="secondary" component="section" className="sticky-top">
      <CardTitle component="h2">{_("Current selection")}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <Title headingLevel="h3">
            <ProductLogo product={product} width="2em" /> {product.name}
          </Title>
          <Divider />
          <SubtleContent>{translatedDescription}</SubtleContent>

          {mode && (
            <>
              <Title headingLevel="h3">{translatedModeName}</Title>

              <Divider />
              <SubtleContent>{translatedModeDescription}</SubtleContent>
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
    patchConfig({ product: { id: selectedProduct.id, mode: selectedMode } });
  };

  return (
    <Page
      breadcrumbs={[
        { label: <ProductSelectionTitle products={products} currentProduct={currentProduct} /> },
      ]}
      endSlot={<InstallerL10nOptions />}
    >
      <Page.Content>
        <Flex gap={{ default: "gapXs" }} direction={{ default: "column" }}>
          <Content isEditorial>
            <ProductSelectionIntro products={products} currentProduct={currentProduct} />
          </Content>
          {currentProduct && (
            <SubtleContent>
              {_(
                "Installation settings will automatically update to match the new product's defaults.",
              )}
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
 * Redirects to root if the system is already registered.
 * Otherwise, renders the product selection interface allowing users to:
 *   - Choose from available products
 *   - View current product information (when changing products)
 */
export default function ProductSelectionPage() {
  const { registration } = useSystemSoftware();

  if (registration) return <Navigate to={ROOT.root} />;

  return <ProductSelectionContent />;
}
