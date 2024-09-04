/*
 * Copyright (c) [2022-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useState } from "react";
import { Card, CardBody, Flex, Form, Grid, GridItem, Radio, Split, Stack } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { Center } from "~/components/layout";
import { useConfigMutation, useProduct } from "~/queries/software";
import styles from "@patternfly/react-styles/css/utilities/Text/text";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

const ResponsiveGridItem = ({ children }) => (
  <GridItem sm={10} smOffset={1} lg={8} lgOffset={2} xl={6} xlOffset={3}>
    {children}
  </GridItem>
);

const Option = ({ product, isChecked, onChange }) => {
  const logoSrc = `assets/logos/${product.icon}`;
  // TRANSLATORS: %s will be replaced by a product name. E.g., "openSUSE Tumbleweed"
  const logoAltText = sprintf(_("%s logo"), product.name);

  return (
    <ResponsiveGridItem>
      <Card isRounded>
        <CardBody>
          <Radio
            name="product"
            id={product.name}
            label={
              <Split hasGutter>
                <img src={logoSrc} alt={logoAltText} />
                <Stack hasGutter>
                  <span className={`${styles.fontSizeLg} ${styles.fontWeightBold}`}>{product.name}</span>
                  <p>{product.description}</p>
                </Stack>
              </Split>
            }
            isChecked={isChecked}
            onChange={onChange}
          />
        </CardBody>
      </Card>
    </ResponsiveGridItem>
  );
};

function ProductSelectionPage() {
  const setConfig = useConfigMutation();
  const { products, selectedProduct } = useProduct({ suspense: true });
  const [nextProduct, setNextProduct] = useState(selectedProduct);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (nextProduct) {
      setConfig.mutate({ product: nextProduct.id });
      setIsLoading(true);
    }
  };

  const isSelectionDisabled = !nextProduct || nextProduct === selectedProduct;

  return (
    <Page>
      <Center>
        <Form id="productSelectionForm" onSubmit={onSubmit}>
          <Grid hasGutter>
            {products.map((product, index) => (
              <Option
                key={index}
                product={product}
                isChecked={nextProduct === product}
                onChange={() => setNextProduct(product)}
              />
            ))}
            <ResponsiveGridItem>
              <Flex justifyContent={{ default: "justifyContentFlexEnd" }}>
                {selectedProduct && !isLoading && <Page.CancelAction navigateTo={-1} />}
                <Page.Action
                  type="submit"
                  form="productSelectionForm"
                  isDisabled={isSelectionDisabled}
                  isLoading={isLoading}
                >
                  {_("Select")}
                </Page.Action>
              </Flex>
            </ResponsiveGridItem>
          </Grid>
        </Form>
      </Center>
    </Page >
  );
}

export default ProductSelectionPage;
