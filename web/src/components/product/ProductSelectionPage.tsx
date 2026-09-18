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
import { isEmpty, toggle } from "radashi";
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
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { Page, SubtleContent } from "~/components/core";
import ProductLogo from "~/components/product/ProductLogo";
import LicenseDialog from "~/components/product/LicenseDialog";
import Text from "~/components/core/Text";
import { patchConfig, putConfig } from "~/api";
import { useProduct, useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { ROOT } from "~/routes/paths";
import { n_, _ } from "~/i18n";

import pfTextStyles from "@patternfly/react-styles/css/utilities/Text/text";

import type { License, Mode, Product } from "~/model/system";

/**
 * Returns the licenses the user must accept to install the given product.
 *
 * Names come from the licenses known by the system. A license the system does
 * not know, or reports without a name, is named after the product.
 */
const productLicenses = (product: Product | undefined, licenses: License[] = []): License[] =>
  (product?.licenses || []).map((id) => {
    const name = licenses.find((l) => l.id === id)?.name;
    return { id, name: name || product.name };
  });

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
  const detailsId = `${product.id}-details`;

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
                    <ProductLogo product={product} width="var(--agm-t--logo--size--inline, 2em)" />{" "}
                    {product.name}
                  </Text>
                }
                body={
                  <Stack hasGutter id={detailsId}>
                    {(!isEmpty(product.licenses) || product.modes) && (
                      <Split hasGutter>
                        {!isEmpty(product.licenses) && (
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
                      <SubtleContent>{product.description}</SubtleContent>
                    </ExpandableSection>
                    {isChecked && availableModes && (
                      <Split hasGutter>
                        {availableModes.map((mode) => {
                          return (
                            <FlexItem key={mode.id}>
                              <Radio
                                key={mode.id}
                                id={mode.id}
                                name="mode"
                                isChecked={mode.id === selectedModeId}
                                onChange={() => onModeChange(mode)}
                                label={<Text isBold>{mode.name}</Text>}
                                description={mode.description}
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
  /** The license to display */
  license: License;
};

/**
 * Button that opens a license dialog when clicked.
 */
const LicenseButton = ({ license, children, ...props }: LicenseButtonProps) => {
  const [showEula, setShowEula] = useState(false);

  const open = () => setShowEula(true);
  const close = () => setShowEula(false);

  return (
    <>
      <Button {...props} onClick={open}>
        {children}
      </Button>
      {showEula && <LicenseDialog license={license} onClose={close} />}
    </>
  );
};

/**
 * Props for EulaCheckbox component
 */
type EulaCheckboxProps = {
  /** The license being accepted */
  license: License;
  /** The product the license belongs to */
  product: Product;
  /**
   * Whether the label names the license instead of the product. Meant for
   * products with several licenses, where each checkbox must tell which
   * license it is about.
   */
  namesLicense?: boolean;
  /** Callback fired when checkbox state changes */
  onChange: (accepted: boolean) => void;
  /** Whether the checkbox is currently checked (i.e., license accepted) */
  isChecked: boolean;
};

/**
 * Checkbox for accepting a product license.
 * Includes a link to view the full license text.
 */
const EulaCheckbox = ({
  license,
  product,
  namesLicense = false,
  onChange,
  isChecked,
}: EulaCheckboxProps) => {
  // FIXME: reuses the single license text, naming the license instead of the
  // product, because of the translation freeze. Add a proper text for products
  // with several licenses once the freeze is over.
  const subject = namesLicense ? license.name : product.name;
  const [textStart, textLink, textEnd] = sprintf(
    // TRANSLATORS: Text used for the license acceptance checkbox. %s will be
    // replaced with the product name and the text in the square brackets [] is
    // used for the link to show the license, please keep the brackets.
    _("I have read and accept the [license] for %s"),
    subject,
  ).split(/[[\]]/);

  return (
    <Checkbox
      isChecked={isChecked}
      onChange={(_, accepted) => onChange(accepted)}
      id={`license-acceptance-${license.id}`}
      label={
        <>
          {textStart}{" "}
          <LicenseButton license={license} variant="link" isInline>
            {textLink}
          </LicenseButton>{" "}
          {textEnd}
        </>
      }
    />
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
  /** The product currently configured in the system */
  currentProduct?: Product;
  /** The product mode configured in the system */
  currentModeId?: string;
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
 * Props for ProductForm component
 */
type ProductFormProps = {
  /** List of all available products */
  products: Product[];
  /** Licenses known by the system */
  licenses?: License[];
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
  licenses,
  currentProduct,
  currentModeId,
  isSubmitted,
  onSubmit,
}: ProductFormProps) => {
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedMode, setSelectedMode] = useState<Mode>();
  const [acceptedLicenses, setAcceptedLicenses] = useState<License["id"][]>([]);
  const selectedLicenses = productLicenses(selectedProduct, licenses);
  const mountEulaCheckbox = !isEmpty(selectedLicenses);
  const eulaAccepted = selectedLicenses.every((l) => acceptedLicenses.includes(l.id));
  const isSelectionDisabled =
    !selectedProduct ||
    isSubmitted ||
    (mountEulaCheckbox && !eulaAccepted) ||
    (!isEmpty(selectedProduct.modes) && !selectedMode);

  const toggleLicenseAcceptance = (id: License["id"]) => {
    setAcceptedLicenses((ids) => toggle(ids, id));
  };

  const onProductSelectionChange = (product) => {
    setAcceptedLicenses([]);
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
            <Stack hasGutter>
              {selectedLicenses.map((license) => (
                <EulaCheckbox
                  key={license.id}
                  license={license}
                  product={selectedProduct}
                  namesLicense={selectedLicenses.length > 1}
                  isChecked={acceptedLicenses.includes(license.id)}
                  onChange={() => toggleLicenseAcceptance(license.id)}
                />
              ))}
            </Stack>
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
            {currentProduct && !isSubmitted && <Page.Back size="lg">{_("Cancel")}</Page.Back>}
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
  /** Licenses known by the system */
  licenses?: License[];
};

/**
 * Card displaying information about the currently selected product.
 *
 * Shows product name, description, and links to view the licenses if applicable.
 */
const CurrentProductInfo = ({ product, modeId, licenses }: CurrentProductInfoProps) => {
  if (!product) return;

  const currentLicenses = productLicenses(product, licenses);

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

          {currentLicenses.length === 1 && (
            <LicenseButton license={currentLicenses[0]} variant="secondary" isInline>
              {_("View license")}
            </LicenseButton>
          )}
          {currentLicenses.length > 1 && (
            <Stack hasGutter>
              {currentLicenses.map((license) => (
                <LicenseButton
                  key={license.id}
                  license={license}
                  variant="secondary"
                  isBlock
                  style={{ textWrap: "balance" }}
                >
                  {license.name}
                </LicenseButton>
              ))}
            </Stack>
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
  const { products, licenses } = useSystem();
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
              licenses={licenses}
              currentProduct={currentProduct}
              currentModeId={product?.mode}
              isSubmitted={isWaiting}
              onSubmit={onSubmit}
            />
          </GridItem>
          <GridItem sm={12} md={4} order={{ default: "0", md: "1" }}>
            {!isWaiting && (
              <CurrentProductInfo
                product={currentProduct}
                modeId={product?.mode}
                licenses={licenses}
              />
            )}
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
