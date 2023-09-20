/*
 * Copyright (c) [2022] SUSE LLC
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

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInstallerClient } from "~/context/installer";
import { useSoftware } from "~/context/software";
import { _ } from "~/i18n";

import {
  Button,
  Card,
  CardBody,
  Form,
  FormGroup,
  Radio
} from "@patternfly/react-core";

import { Icon, Loading } from "~/components/layout";
import { Title, PageIcon, MainActions } from "~/components/layout/Layout";

function ProductSelectionPage() {
  const client = useInstallerClient();
  const navigate = useNavigate();
  const { products, selectedProduct } = useSoftware();
  const previous = selectedProduct?.id;
  const [selected, setSelected] = useState(selectedProduct?.id);

  useEffect(() => {
    // TODO: display a notification in the UI to emphasizes that
    // selected product has changed
    return client.software.onProductChange(() => navigate("/"));
  }, [client.software, navigate]);

  const isSelected = p => p.id === selected;

  const accept = async (e) => {
    e.preventDefault();
    if (selected === previous) {
      navigate("/");
      return;
    }

    // TODO: handle errors
    await client.software.selectProduct(selected);
    client.manager.startProbing();
    navigate("/");
  };

  if (!products) return (
    <Loading text={_("Loading available products, please wait...")} />
  );

  const buildOptions = () => {
    const options = products.map((p) => (
      <Card key={p.id} className={isSelected(p) && "selected-product"}>
        <CardBody>
          <Radio
            id={p.id}
            name="product"
            label={p.name}
            description={p.description}
            isChecked={isSelected(p)}
            onClick={() => setSelected(p.id)}
          />
        </CardBody>
      </Card>
    ));

    return options;
  };

  return (
    <>
      {/* TRANSLATORS: page header */}
      <Title>{_("Product selection")}</Title>
      <PageIcon><Icon name="home_storage" /></PageIcon>
      <MainActions>
        <Button size="lg" variant="primary" form="product-selector" type="submit">
          {/* TRANSLATORS: button label */}
          {_("Select")}
        </Button>
      </MainActions>

      <Form id="product-selector" onSubmit={accept}>
        <FormGroup isStack label={_("Choose a product")} role="radiogroup">
          {buildOptions()}
        </FormGroup>
      </Form>
    </>
  );
}

export default ProductSelectionPage;
