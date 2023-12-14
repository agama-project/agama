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
import { Form, FormGroup } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Page } from "~/components/core";
import { Loading } from "~/components/layout";
import { ProductSelector } from "~/components/product";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";

function ProductSelectionPage() {
  const { manager, software } = useInstallerClient();
  const navigate = useNavigate();
  const { products, selectedProduct } = useProduct();
  const [newProductId, setNewProductId] = useState(selectedProduct?.id);

  useEffect(() => {
    // TODO: display a notification in the UI to emphasizes that
    // selected product has changed
    return software.product.onChange(() => navigate("/"));
  }, [software, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (newProductId !== selectedProduct?.id) {
      // TODO: handle errors
      await software.product.select(newProductId);
      manager.startProbing();
    }

    navigate("/");
  };

  if (!products) return (
    <Loading text={_("Loading available products, please wait...")} />
  );

  return (
    // TRANSLATORS: page title
    <Page icon="home_storage" title={_("Product selection")}>
      <Form id="productSelectionForm" onSubmit={onSubmit}>
        <FormGroup isStack label={_("Choose a product")} role="radiogroup">
          <ProductSelector value={newProductId} products={products} onChange={setNewProductId} />
        </FormGroup>
      </Form>

      <Page.Actions>
        <Page.Action type="submit" form="productSelectionForm">
          { _("Select") }
        </Page.Action>
      </Page.Actions>
    </Page>
  );
}

export default ProductSelectionPage;
