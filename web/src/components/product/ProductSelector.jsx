/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React from "react";
import { Card, CardBody, Grid, GridItem, Radio } from "@patternfly/react-core";
import styles from '@patternfly/react-styles/css/utilities/Text/text';
import { _ } from "~/i18n";

const Label = ({ children }) => (
  <span className={`${styles.fontSizeLg} ${styles.fontWeightBold}`}>
    {children}
  </span>
);

export default function ProductSelector({ products, defaultChecked }) {
  if (products?.length === 0) return <p>{_("No products available for selection")}</p>;

  return (
    <Grid hasGutter>
      {products.map((product, index) => (
        <GridItem key={index} sm={10} smOffset={1} lg={8} lgOffset={2} xl={6} xlOffset={3}>
          <Card key={index} isRounded>
            <CardBody>
              <Radio
                key={index}
                name="product"
                id={product.name}
                label={<Label>{product.name}</Label>}
                body={product.description}
                value={JSON.stringify(product)}
                defaultChecked={defaultChecked === product}
              />
            </CardBody>
          </Card>
        </GridItem>
      ))}
    </Grid>
  );
}
