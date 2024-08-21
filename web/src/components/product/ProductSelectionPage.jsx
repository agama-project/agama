/* eslint @typescript-eslint/no-var-requires: "off" */
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
import { Card, CardBody, Flex, Form, Grid, GridItem } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { Center } from "~/components/layout";
import { useConfigMutation, useProduct } from "~/queries/software";
import { _ } from "~/i18n";
import styles from "@patternfly/react-styles/css/utilities/Text/text";

const Label = ({ children }) => (
  <span className={`${styles.fontSizeLg} ${styles.fontWeightBold}`}>{children}</span>
);

function ProductSelectionPage() {
  const { products, selectedProduct } = useProduct({ suspense: true });
  const setConfig = useConfigMutation();
  const [nextProduct, setNextProduct] = useState(selectedProduct);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (nextProduct) {
      setConfig.mutate({ product: nextProduct.id });
      setIsLoading(true);
    }
  };

  const Item = ({ children }) => (
    <GridItem sm={10} smOffset={1} lg={8} lgOffset={2} xl={6} xlOffset={3}>
      {children}
    </GridItem>
  );

  const ProductIcon = ({ src, alt }) => {
    // Ensure that we display something even if icon path is incorrect
    const productIcon = require(`../../assets/products/${src}`);

    return (
      <img
        src={productIcon}
        alt={alt}
        width="80px"
        style={{ height: 'auto', width: '10%', float: 'left', padding: '0 20px 20px 0' }}
      />
    );
  };

  const isSelectionDisabled = !nextProduct || nextProduct === selectedProduct;

  const handleCardClick = (product) => {
    setNextProduct(product);
  };

  return (
    <Page>
      <Center>
        <Form id="productSelectionForm" onSubmit={onSubmit}>
          <Grid hasGutter>
            {products.map((product, index) => (
              <Item key={index}>
                <Card
                  key={index}
                  isRounded
                  onClick={() => handleCardClick(product)}
                  style={{
                    cursor: 'pointer',  // Change the cursor to indicate clickable
                    border: nextProduct === product ? '2px solid #0066cc' : 'none',  // Optional: highlight selected card
                  }}
                >
                  <CardBody>
                    <ProductIcon
                      src={product.icon}
                      alt={`${product.name} product icon`}
                    />
                    <div>
                      <Label>{product.name}</Label>
                      <p>{product.description}</p>
                    </div>
                  </CardBody>
                </Card>
              </Item>
            ))}
            <Item>
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
            </Item>
          </Grid>
        </Form>
      </Center>
    </Page>
  );
}

export default ProductSelectionPage;