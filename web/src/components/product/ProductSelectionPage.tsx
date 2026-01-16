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

import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
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
  List,
  ListItem,
  Split,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import { Navigate, useNavigate } from "react-router";
import { NestedContent, Page, SubtleContent } from "~/components/core";
import pfTextStyles from "@patternfly/react-styles/css/utilities/Text/text";
import pfRadioStyles from "@patternfly/react-styles/css/components/Radio/radio";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { n_, _ } from "~/i18n";
import agama from "~/agama";
import LicenseDialog from "./LicenseDialog";
import { useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { patchConfig } from "~/api";
import { ROOT } from "~/routes/paths";
import { Product } from "~/model/system";
import ProductLogo from "~/components/product/ProductLogo";
import Text from "../core/Text";

const Option = ({ product, isChecked, onChange, isSelectable = true, isTruncating = true }) => {
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
              <label
                htmlFor={product.id}
                className={`${pfTextStyles.fontSizeLg} ${pfTextStyles.fontWeightBold}`}
              >
                {isSelectable && (
                  <input
                    id={product.id}
                    type="radio"
                    name="product"
                    className={pfRadioStyles.radioInput}
                    checked={isChecked}
                    onChange={onChange}
                    aria-details={detailsId}
                  />
                )}
                <ProductLogo product={product} width="2em" /> {product.name}
              </label>

              <p id={detailsId}>
                {isTruncating ? (
                  <NestedContent margin="mxXl">
                    <ExpandableSection
                      variant="truncate"
                      truncateMaxLines={2}
                      toggleTextCollapsed={_("Show more")}
                      toggleTextExpanded={_("Show less")}
                    >
                      <SubtleContent>{translatedDescription}</SubtleContent>
                    </ExpandableSection>
                  </NestedContent>
                ) : (
                  translatedDescription
                )}
              </p>
            </FlexItem>
          </Flex>
        </CardBody>
      </Card>
    </ListItem>
  );
};

const BackLink = () => {
  const navigate = useNavigate();
  return (
    <Button variant="link" onClick={() => navigate("/")}>
      {_("Cancel")}
    </Button>
  );
};

function ProductSelectionPage() {
  const navigate = useNavigate();
  const { products } = useSystem();
  const { registration } = useSystemSoftware();
  const selectedProduct = useProductInfo();
  const [nextProduct, setNextProduct] = useState(selectedProduct);
  // FIXME: should not be accepted by default first selectedProduct is accepted
  // because it's a singleProduct iso.
  const [licenseAccepted, setLicenseAccepted] = useState(!!selectedProduct);
  const [showLicense, setShowLicense] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    if (!isWaiting) return;

    if (selectedProduct?.id === nextProduct?.id) {
      navigate(ROOT.root);
    }
  }, [isWaiting, navigate, nextProduct, selectedProduct]);

  if (registration && selectedProduct) return <Navigate to={ROOT.root} />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nextProduct) {
      patchConfig({ product: { id: nextProduct.id } });
      setIsWaiting(true);
    }
  };

  const selectProduct = (product: Product) => {
    setNextProduct(product);
    setLicenseAccepted(selectedProduct === product);
  };

  const selectionHasChanged = nextProduct && nextProduct !== selectedProduct;
  const mountLicenseCheckbox = !isEmpty(nextProduct?.license);
  const isSelectionDisabled =
    isWaiting || !selectionHasChanged || (mountLicenseCheckbox && !licenseAccepted);

  const [eulaTextStart, eulaTextLink, eulaTextEnd] = sprintf(
    // TRANSLATORS: Text used for the license acceptance checkbox. %s will be
    // replaced with the product name and the text in the square brackets [] is
    // used for the link to show the license, please keep the brackets.
    _("I have read and accept the [license] for %s"),
    nextProduct?.name || selectedProduct?.name,
  ).split(/[[\]]/);

  const [selectedTitleStart, selectedTitleEnd] = _("Currently selected %s").split("%s");

  return (
    <Page
      breadcrumbs={[{ label: selectedProduct ? _("Change product") : _("Select a product") }]}
      showInstallerOptions
    >
      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12} xl={8}>
            {selectedProduct && (
              <>
                <Stack>
                  <Content isEditorial>
                    {selectedTitleStart} <Text isBold>{selectedProduct.name}</Text>{" "}
                    {selectedTitleEnd}
                  </Content>
                  <Content component="p">
                    <ExpandableSection
                      toggleTextCollapsed={_("Show description")}
                      toggleTextExpanded={_("Hide description")}
                    >
                      <NestedContent>
                        <SubtleContent>{selectedProduct.description}</SubtleContent>
                      </NestedContent>
                    </ExpandableSection>
                  </Content>
                </Stack>
                <Divider />
              </>
            )}
          </GridItem>
          <GridItem sm={12} xl={8}>
            <Content isEditorial>
              {selectedProduct
                ? sprintf(
                    n_(
                      "There is other product available. Selecting a different product will automatically adjust some installation settings to match the chosen product's defaults.",
                      "There are 2 other products available. Selecting a different product will automatically adjust some installation settings to match the chosen product's defaults.",
                      products.length - 1,
                    ),
                    products.length - 1,
                  )
                : sprintf(_("There are %d products available"), products.length)}
            </Content>
            <Form id="productSelectionForm" onSubmit={onSubmit}>
              <FormGroup role="radiogroup">
                <List isPlain>
                  {products.map((product, index) => {
                    if (product === selectedProduct) return undefined;

                    return (
                      <Option
                        key={index}
                        product={product}
                        isChecked={nextProduct?.id === product?.id}
                        onChange={() => selectProduct(product)}
                      />
                    );
                  })}
                </List>
              </FormGroup>
            </Form>
          </GridItem>
        </Grid>
        {showLicense && (
          <LicenseDialog
            onClose={() => setShowLicense(false)}
            product={nextProduct || selectedProduct}
          />
        )}
        <Stack hasGutter>
          <StackItem>
            {mountLicenseCheckbox && (
              <Checkbox
                isChecked={licenseAccepted}
                onChange={(_, accepted) => setLicenseAccepted(accepted)}
                isDisabled={selectedProduct === nextProduct}
                id="license-acceptance"
                form="productSelectionForm"
                label={
                  <>
                    {eulaTextStart}{" "}
                    <Button variant="link" isInline onClick={() => setShowLicense(true)}>
                      {eulaTextLink}
                    </Button>{" "}
                    {eulaTextEnd}
                  </>
                }
              />
            )}
          </StackItem>
          <StackItem>
            <Split hasGutter>
              <Page.Submit
                form="productSelectionForm"
                isDisabled={isSelectionDisabled}
                isLoading={isWaiting}
                variant={isWaiting ? "secondary" : "primary"}
              >
                {selectedProduct ? _("Change") : _("Select")}
              </Page.Submit>
              {selectedProduct && <BackLink />}
            </Split>
          </StackItem>
        </Stack>
      </Page.Content>
    </Page>
  );
}

export default ProductSelectionPage;
