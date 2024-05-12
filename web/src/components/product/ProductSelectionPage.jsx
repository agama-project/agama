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
import { Form, Flex, FormGroup, PageGroup, PageSection } from "@patternfly/react-core";
import styles from '@patternfly/react-styles/css/utilities/Flex/flex';

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
    e.preventDefault();
    const dataForm = new FormData(e.target);
    const nextProduct = JSON.parse(dataForm.get("product"));

    if (nextProduct?.id !== selectedProduct?.id) {
      // TODO: handle errors
      await product.select(newProductId);
      manager.startProbing();
    }

    navigate(location?.state?.from?.pathname || "/");
  };

  if (!products) return (
    <Loading text={_("Loading available products, please wait...")} />
  );

  return (
    <>
      <PageSection isFilled>
        <Form id="productSelectionForm" onSubmit={onSubmit}>
          <FormGroup isStack>
            <ProductSelector defaultChecked={selectedProduct} products={products} />
          </FormGroup>
        </Form>
      </PageSection>

      <PageGroup hasShadowTop className={styles.flexGrow_0} stickyOnBreakpoint={{ default: "bottom" }}>
        <PageSection variant="light">
          <Page.Actions>
            <Flex justifyContent={{ default: "justifyContentFlexEnd" }}>
              <Page.CancelAction />
              <Page.Action type="submit" form="productSelectionForm">
                {_("Select")}
              </Page.Action>
            </Flex>
          </Page.Actions>
        </PageSection>
      </PageGroup>
    </>
  );
}

export default ProductSelectionPage;
