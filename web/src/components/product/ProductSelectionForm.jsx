/*
 * Copyright (c) [2023] SUSE LLC
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
import { Card, CardBody, Form, FormGroup, Radio } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { If } from "~/components/core";
import { noop } from "~/utils";
import { useProduct } from "~/context/product";

const ProductOptions = ({ value, onOptionClick = noop }) => {
  const { products } = useProduct();

  const isSelected = (product) => product.id === value;

  const options = products.map((p) => (
    <Card key={p.id} className={isSelected(p) && "selected-product"}>
      <CardBody>
        <Radio
          id={p.id}
          name="product"
          label={p.name}
          description={p.description}
          isChecked={isSelected(p)}
          onClick={() => onOptionClick(p.id)}
        />
      </CardBody>
    </Card>
  ));

  return options;
};

export default function ProductSelectionForm({ id, onSubmit: onSubmitProp = noop }) {
  const { products, selectedProduct } = useProduct();
  const [selected, setSelected] = useState(selectedProduct?.id);

  const onSubmit = async (e) => {
    e.preventDefault();
    onSubmitProp(selected);
  };

  return (
    <Form id={id || "product-selector-form"} onSubmit={onSubmit}>
      <FormGroup isStack label={_("Choose a product")} role="radiogroup">
        <If
          condition={products.length === 0}
          then={<p>{_("No products found")}</p>}
          else={<ProductOptions value={selected} onOptionClick={setSelected} />}
        />
      </FormGroup>
    </Form>
  );
}
