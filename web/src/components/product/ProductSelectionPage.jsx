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

import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Form, FormGroup } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Page } from "~/components/core";
import { Loading } from "~/components/layout";
import { ProductSelector } from "~/components/product";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";

function ProductSelectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { manager, product } = useInstallerClient();
  const { products, selectedProduct } = useProduct();

  // FIXME: Review below useEffect.
  useEffect(() => {
    // TODO: display a notification in the UI to emphasizes that
    // selected product has changed
    return product.onChange(() => navigate("/"));
  }, [product, navigate]);

  const onSubmit = async (e) => {
    // NOTE: Using FormData here allows having a not controlled selector,
    // removing small pieces of internal state and simplifying components.
    // We should evaluate to use it or to use a ReactRouterDom/Form.
    // Also, to have into consideration React 19 Actions, https://react.dev/blog/2024/04/25/react-19#actions
    // FIXME: re-evaluate if we should work with the entire product object or
    // just the id in the form (the latest avoids the need of JSON.stringify &
    // JSON.parse)
    e.preventDefault();
    const dataForm = new FormData(e.target);
    const nextProductId = JSON.parse(dataForm.get("product"))?.id;

    if (nextProductId !== selectedProduct?.id) {
      // TODO: handle errors
      await product.select(nextProductId);
      manager.startProbing();
    }

    navigate(location?.state?.from?.pathname || "/");
  };

  if (!products) return (
    <Loading text={_("Loading available products, please wait...")} />
  );

  return (
    <>
      <Page.MainContent>
        <Form id="productSelectionForm" onSubmit={onSubmit}>
          <FormGroup isStack>
            <ProductSelector defaultChecked={selectedProduct} products={products} />
          </FormGroup>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="productSelectionForm">
          {_("Select")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}

export default ProductSelectionPage;
