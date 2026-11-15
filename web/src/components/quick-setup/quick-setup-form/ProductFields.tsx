/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useId, useState } from "react";
import { isEmpty, toggle } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Button,
  ExpandableSection,
  Flex,
  FormGroup,
  Gallery,
  HelperText,
  HelperTextItem,
  Radio,
  Stack,
} from "@patternfly/react-core";
import VisualTooltip from "~/components/core/VisualTooltip";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import Icon from "~/components/layout/Icon";
import EulaCheckbox from "~/components/product/EulaCheckbox";
import LicenseButton from "~/components/product/LicenseButton";
import ProductLogo from "~/components/product/ProductLogo";
import { hasKnownName, productLicenses } from "~/components/product/licenses";
import ProductSelectorModal from "~/components/quick-setup/ProductSelectorModal";
import { withForm } from "~/hooks/form";
import { _ } from "~/i18n";
import { defaultOptions } from "./fields";
import { changesProduct } from "./transformations";

import type { License, Product } from "~/model/system";
import type { QuickSetupData } from "./queries";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

/** The product logo and name, as shown in the field and its options. */
const ProductName = ({ product }: { product: Product }) => (
  <>
    <ProductLogo product={product} width="var(--agm-t--logo--size--inline, 1.5em)" /> {product.name}
  </>
);

type DescriptionToggleProps = {
  isExpanded: boolean;
  onToggle: () => void;
  /** Id of the description it shows and hides. */
  descriptionId: string;
};

/**
 * Shows or hides the description of the picked product, next to it. A fixed
 * name with its state, as a disclosure: the description was read when choosing
 * the product, so reading it again stays one press away without taking room.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 */
const DescriptionToggle = ({ isExpanded, onToggle, descriptionId }: DescriptionToggleProps) => {
  // TRANSLATORS: name of the button showing or hiding the description of the
  // picked product
  const label = _("Product description");
  // The name stays as is, its state told apart, while the tooltip says what
  // pressing it does.
  const tooltip = isExpanded
    ? // TRANSLATORS: tooltip of the button hiding the description of the
      // picked product
      _("Hide product description")
    : // TRANSLATORS: tooltip of the button showing the description of the
      // picked product
      _("Show product description");

  return (
    <VisualTooltip content={tooltip} position="top">
      <Button
        variant="plain"
        aria-label={label}
        aria-expanded={isExpanded}
        aria-controls={descriptionId}
        // Pressed while shown.
        isClicked={isExpanded}
        icon={<Icon name="text_snippet" />}
        onClick={onToggle}
      />
    </VisualTooltip>
  );
};

type ProductDetailsProps = {
  product: Product;
  licenses: License[];
  /** Whether its licenses were accepted already, so they can be read again. */
  hasAcceptedLicenses: boolean;
  /** Whether the description is shown. */
  showsDescription: boolean;
  descriptionId: string;
};

/**
 * What is known about the picked product, one step in below it: its
 * description, when asked for, and a way to read again each license accepted
 * already.
 */
const ProductDetails = ({
  product,
  licenses,
  hasAcceptedLicenses,
  showsDescription,
  descriptionId,
}: ProductDetailsProps) => {
  const accepted = hasAcceptedLicenses ? productLicenses(product, licenses) : [];

  return (
    // Nested as the mode and licenses below it are, one step in.
    <div className={[spacingStyles.mlMd, textStyles.fontSizeSm].join(" ")}>
      {product.description && (
        <div
          id={descriptionId}
          hidden={!showsDescription}
          className={[spacingStyles.mtXs, textStyles.textColorSubtle].join(" ")}
        >
          {product.description}
        </div>
      )}
      {!isEmpty(accepted) && (
        <Flex className={spacingStyles.mtXs} gap={{ default: "gapMd" }}>
          {accepted.map((license) => (
            <LicenseButton
              key={license.id}
              license={license}
              dialogTitle={product.name}
              variant="link"
              isInline
              className="agm-inline-action"
            >
              {accepted.length > 1 && hasKnownName(license, licenses)
                ? // TRANSLATORS: opens a license of the product accepted before, to
                  // read it again. %s is the license name.
                  sprintf(_("View %s"), license.name)
                : // TRANSLATORS: opens the product license accepted before, to read
                  // it again
                  _("View accepted license")}
            </LicenseButton>
          ))}
        </Flex>
      )}
    </div>
  );
};

/**
 * What the picked product still asks for: its mode, none picked at first, and
 * its licenses to accept, unless accepted already.
 */
const ProductChoices = withForm({
  ...defaultOptions,
  props: {} as { product: Product; licenses: License[]; asksLicenses: boolean },
  render: function Render({ form, product, licenses, asksLicenses }) {
    const productLicensesList = productLicenses(product, licenses);
    const hasModes = !isEmpty(product.modes);
    const hasLicenses = asksLicenses && !isEmpty(productLicensesList);

    if (!hasModes && !hasLicenses) return null;

    return (
      <FieldNestedContent>
        {/* Apart, so the licenses do not read as one more mode. */}
        <Flex
          direction={{ default: "column" }}
          flexWrap={{ default: "nowrap" }}
          gap={{ default: "gapLg" }}
        >
          {hasModes && (
            <form.AppField name="mode">
              {(field) => (
                <FormGroup
                  role="radiogroup"
                  fieldId="mode"
                  // TRANSLATORS: label of the choice of how to install the product,
                  // e.g. a standard or an immutable system
                  label={_("Mode")}
                >
                  {/* Side by side while there is room, one below the other otherwise. */}
                  <Gallery hasGutter minWidths={{ default: "16rem" }}>
                    {product.modes.map((mode) => (
                      <Radio
                        key={mode.id}
                        id={`mode-${mode.id}`}
                        name="mode"
                        isChecked={field.state.value === mode.id}
                        onChange={() => field.handleChange(mode.id)}
                        label={mode.name}
                        description={
                          <ExpandableSection
                            variant="truncate"
                            toggleTextCollapsed={
                              // TRANSLATORS: expands a shortened text to show all of it
                              _("Show more")
                            }
                            toggleTextExpanded={
                              // TRANSLATORS: shortens the text back to its first lines
                              _("Show less")
                            }
                            truncateMaxLines={2}
                          >
                            {mode.description}
                          </ExpandableSection>
                        }
                      />
                    ))}
                  </Gallery>
                </FormGroup>
              )}
            </form.AppField>
          )}
          {hasLicenses && (
            <form.AppField name="acceptedLicenses">
              {(field) => (
                <Stack hasGutter>
                  {productLicensesList.map((license) => (
                    <EulaCheckbox
                      key={license.id}
                      license={license}
                      product={product}
                      namesLicense={
                        productLicensesList.length > 1 && hasKnownName(license, licenses)
                      }
                      isChecked={field.state.value.includes(license.id)}
                      onChange={() => field.handleChange((ids) => toggle(ids, license.id))}
                    />
                  ))}
                </Stack>
              )}
            </form.AppField>
          )}
        </Flex>
      </FieldNestedContent>
    );
  },
});

/**
 * The product to install, with its mode and licenses nested below once picked.
 *
 * Several products: a dropdown with their logos and names, plus a way to browse
 * them with their details. A single product, or one that cannot change (as on
 * a registered system): shown as text, with its mode if it has one; a
 * registered one tells why it cannot change. Below the picked product, nested
 * as its mode and licenses are: its description, and a way to read the
 * licenses accepted already, which are not asked again.
 *
 * Picking another product or mode tells, below it, that the settings not set
 * here go back to the product defaults.
 */
const ProductFields = withForm({
  ...defaultOptions,
  props: {} as { data: QuickSetupData; isLocked?: boolean },
  render: function Render({ form, data, isLocked = false }) {
    const { products, licenses } = data;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showsDescription, setShowsDescription] = useState(false);
    const descriptionId = useId();
    const findProduct = (id: string) => products.find((p) => p.id === id);
    const options = products.map((product) => ({
      value: product.id,
      label: <ProductName product={product} />,
    }));
    // TRANSLATORS: label of the field for the product to install
    const label = _("Product");

    return (
      <>
        {/* Spans the column, so the modes below take the room there is, not the
            width of what happens to be shown. */}
        <div className="agm-stretched-field">
          <form.AppField
            name="product"
            listeners={{
              // Mode and licenses belong to the product they were picked for.
              onChange: () => {
                form.setFieldValue("mode", "");
                form.setFieldValue("acceptedLicenses", []);
              },
            }}
          >
            {(field) => {
              const product = findProduct(field.state.value);
              const isCurrent = product?.id === data.currentProduct?.id;
              const descriptionToggle = product?.description && (
                <DescriptionToggle
                  isExpanded={showsDescription}
                  onToggle={() => setShowsDescription(!showsDescription)}
                  descriptionId={descriptionId}
                />
              );
              const details = product && (
                <form.Subscribe
                  // Accepted when the current product was chosen, until it
                  // changes. A registered one cannot change.
                  selector={(s) =>
                    isLocked || (isCurrent && !s.fieldMeta.acceptedLicenses?.isDirty)
                  }
                >
                  {(hasAcceptedLicenses) => (
                    <>
                      <ProductDetails
                        product={product}
                        licenses={licenses}
                        hasAcceptedLicenses={hasAcceptedLicenses}
                        showsDescription={showsDescription}
                        descriptionId={descriptionId}
                      />
                      {!isLocked && (
                        <ProductChoices
                          form={form}
                          product={product}
                          licenses={licenses}
                          asksLicenses={!hasAcceptedLicenses}
                        />
                      )}
                    </>
                  )}
                </form.Subscribe>
              );

              if (isLocked && product) {
                const mode = product.modes?.find((m) => m.id === form.getFieldValue("mode"));
                return (
                  <field.ReadOnlyField
                    label={label}
                    text={
                      <>
                        <ProductName product={product} />
                        {mode && <> · {mode.name}</>} {descriptionToggle}
                      </>
                    }
                  >
                    {details}
                    <HelperText className={spacingStyles.mtSm}>
                      <HelperTextItem icon={<Icon name="lock" />}>
                        {/* TRANSLATORS: shown below the product on a registered system */}
                        {_("The product is registered and cannot be changed.")}
                      </HelperTextItem>
                    </HelperText>
                  </field.ReadOnlyField>
                );
              }

              if (products.length === 1) {
                return (
                  <field.ReadOnlyField
                    label={label}
                    text={
                      <>
                        <ProductName product={products[0]} /> {descriptionToggle}
                      </>
                    }
                  >
                    {details}
                  </field.ReadOnlyField>
                );
              }

              return (
                <>
                  <field.DropdownField
                    label={label}
                    // TRANSLATORS: shown in the product field until one is picked
                    placeholder={_("Select a product")}
                    options={options}
                    actions={descriptionToggle}
                    maxMenuHeight="15rem"
                    footerEntry={{
                      // TRANSLATORS: last entry of the product list, opening a dialog
                      // with the products and their descriptions
                      label: _("Browse with details..."),
                      onSelect: () => setIsDialogOpen(true),
                      opensDialog: true,
                    }}
                  >
                    {() => details}
                  </field.DropdownField>
                  {isDialogOpen && (
                    <ProductSelectorModal
                      isOpen
                      products={products}
                      selected={field.state.value}
                      onSelect={(id) => {
                        setIsDialogOpen(false);
                        field.handleChange(id);
                      }}
                      onCancel={() => setIsDialogOpen(false)}
                    />
                  )}
                </>
              );
            }}
          </form.AppField>
        </div>
        <form.Subscribe selector={(s) => changesProduct(s.values, data)}>
          {(changes) =>
            changes && (
              <HelperText>
                {/* The sentence itself tells what happens: no status word appended. */}
                <HelperTextItem variant="warning" screenReaderText="">
                  {_(
                    // TRANSLATORS: shown below the product field when another
                    // product or mode is picked
                    "Settings not set here, such as software or network, go back to the defaults of the new product.",
                  )}
                </HelperTextItem>
              </HelperText>
            )
          }
        </form.Subscribe>
      </>
    );
  },
});

export default ProductFields;
