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
import { Link, Page, SubtleContent } from "~/components/core";
import ProductLogo from "~/components/product/ProductLogo";
import LicenseDialog from "~/components/product/LicenseDialog";
import Text from "~/components/core/Text";
import agama from "~/agama";
import { patchConfig } from "~/api";
import { useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { ROOT } from "~/routes/paths";
import { Product } from "~/model/system";
import { n_, _ } from "~/i18n";

import pfTextStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Props for ProductFormProductOption component
 */
type ProductFormProductOptionProps = {
  /** The product to display as an option */
  product: Product;
  /** Whether this product option is currently selected */
  isChecked: boolean;
  /** Callback fired when the product is selected */
  onChange: () => void;
  /** Callback fired when the mode is changed */
  onModeChange: (mode: string) => void;
};

/**
 * Renders a single product option as a radio button with expandable details.
 */
const ProductFormProductOption = ({
  product,
  isChecked,
  onChange,
  onModeChange,
}: ProductFormProductOptionProps) => {
  const detailsId = `${product.id}-details`;
  const currentLocale = agama.language.replace("-", "_");

  const translatedDescription =
    product.translations?.description[currentLocale] || product.description;

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
                        {product.modes && (
                          <Label variant="outline" isCompact>
                            <Text component="small">
                              {sprintf(_("%d modes available"), product.modes.length)}
                            </Text>
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
                    {isChecked && product.modes && (
                      <Split hasGutter>
                        {product.modes.map((mode) => (
                          <FlexItem key={mode.id}>
                            <Radio
                              key={mode.id}
                              id={mode.id}
                              name="mode"
                              onChange={() => onModeChange(mode.id)}
                              label={<Text isBold>{mode.name}</Text>}
                              description={mode.description}
                            />
                          </FlexItem>
                        ))}
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
};

/**
 * Renders the submit button label based on context.
 * Shows "Change to [Product]" or "Select [Product]" depending on whether
 * user is selecting a product for first time or making a change.
 */
const ProductFormSubmitLabel = ({
  currentProduct,
  selectedProduct,
}: ProductFormSubmitLabelProps) => {
  // FIXME: add logic to include information about the mode
  const action = currentProduct ? _("Change to %s") : _("Select %s");
  const fallback = currentProduct ? _("Change") : _("Select");

  if (!selectedProduct) {
    return fallback;
  }

  const [labelStart, labelEnd] = action.split("%s");

  return (
    <Text isBold>
      {labelStart} {selectedProduct.name} {labelEnd}
    </Text>
  );
};

/**
 * Props for ProductFormSubmitLabelHelp component
 */
type ProductFormSubmitLabelHelpProps = {
  /** The product selected by the user */
  selectedProduct?: Product;
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
  hasEula,
  isEulaAccepted,
}: ProductFormSubmitLabelHelpProps) => {
  let text: string;

  if (!selectedProduct) {
    text = _("Select a product to continue.");
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
  /** Callback fired when the form is submitted with a selected product */
  onSubmit: (product: Product, mode: string) => void;
  /** Whether the form was already submitted */
  isSubmitted: boolean;
};

/**
 * Form for selecting a product.
 *
 * Manages product selection state, license acceptance, and form validation.
 * Excludes the current product from the list of options.
 *
 * TODO: use a reducer instead of bunch of isolated state pieces
 */
const ProductForm = ({ products, currentProduct, isSubmitted, onSubmit }: ProductFormProps) => {
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedMode, setSelectedMode] = useState<string>();
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const mountEulaCheckbox = selectedProduct && !isEmpty(selectedProduct.license);
  const isSelectionDisabled =
    !selectedProduct || isSubmitted || (mountEulaCheckbox && !eulaAccepted);

  const onProductSelectionChange = (product) => {
    setEulaAccepted(false);
    setSelectedMode(undefined);
    setSelectedProduct(product);
  };

  const onFormSubmission = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit(selectedProduct, selectedMode);
  };

  return (
    <Form id="productSelectionForm" onSubmit={onFormSubmission}>
      <FormGroup
        role="radiogroup"
        label={sprintf(
          n_(
            "Switch to other available product",
            "Choose from %d available products",
            products.length - 1,
          ),
          products.length - 1,
        )}
      >
        <List isPlain>
          {products.map((product, index) => {
            if (product.id === currentProduct?.id && !product.modes) return undefined;

            return (
              <ProductFormProductOption
                key={index}
                product={product}
                isChecked={selectedProduct?.id === product?.id}
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
            >
              <ProductFormSubmitLabel
                currentProduct={currentProduct}
                selectedProduct={selectedProduct}
              />
            </Page.Submit>
            {currentProduct && (
              <Link to={ROOT.overview} size="lg" variant="link">
                {_("Cancel")}
              </Link>
            )}
          </Split>
        </StackItem>
        <StackItem>
          <ProductFormSubmitLabelHelp
            selectedProduct={selectedProduct}
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
};

/**
 * Card displaying information about the currently selected product.
 *
 * Shows product name, description, and a link to view the license if applicable.
 */
const CurrentProductInfo = ({ product }: CurrentProductInfoProps) => {
  if (!product) return;

  return (
    <Card variant="secondary" component="section" className="sticky-top">
      <CardTitle component="h2">{_("Current selection")}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <Title headingLevel="h3">
            <ProductLogo product={product} width="2em" /> {product.name}
          </Title>
          <Divider />
          <SubtleContent>{product.description}</SubtleContent>

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
    // FIXME: use Mode as expected
    patchConfig({ product: { id: selectedProduct.id, mode: selectedMode } });
  };

  const introText = n_(
    "Select a product and confirm your choice.",
    "Select a product and confirm your choice at the end of the list.",
    products.length - 1,
  );

  return (
    <Page
      breadcrumbs={[{ label: currentProduct ? _("Change product") : _("Select a product") }]}
      showInstallerOptions
    >
      <Page.Content>
        <Flex gap={{ default: "gapXs" }} direction={{ default: "column" }}>
          <Content isEditorial>{introText}</Content>
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
              isSubmitted={isWaiting}
              onSubmit={onSubmit}
            />
          </GridItem>
          <GridItem sm={12} md={4} order={{ default: "0", md: "1" }}>
            {!isWaiting && <CurrentProductInfo product={currentProduct} />}
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
