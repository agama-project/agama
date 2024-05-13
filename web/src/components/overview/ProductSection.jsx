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

import React, { useEffect, useState } from "react";
import { Text } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { toValidationError, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";
import { Section, SectionSkeleton } from "~/components/core";
import { _ } from "~/i18n";

const errorsFrom = (issues) => {
  const errors = issues.filter(i => i.severity === "error");
  return errors.map(toValidationError);
};

const Content = ({ isLoading = false }) => {
  const { registration, selectedProduct } = useProduct();

  if (isLoading) return <SectionSkeleton numRows={1} />;

  const isRegistered = registration?.code !== null;
  const productName = selectedProduct?.name;

  return (
    <Text>
      {/* TRANSLATORS: %s is replaced by a product name (e.g. SLES) */}
      {isRegistered ? sprintf(_("%s (registered)"), productName) : productName}
    </Text>
  );
};

export default function ProductSection() {
  const { product } = useInstallerClient();
  const [issues, setIssues] = useState([]);
  const { selectedProduct } = useProduct();
  const { cancellablePromise } = useCancellablePromise();

  useEffect(() => {
    cancellablePromise(product.getIssues()).then(setIssues);
    return product.onIssuesChange(setIssues);
  }, [cancellablePromise, setIssues, product]);

  const isLoading = !selectedProduct;
  const errors = isLoading ? [] : errorsFrom(issues);

  return (
    <Section
      key="product-section"
      // TRANSLATORS: page section
      title={_("Product")}
      icon="inventory_2"
      errors={errors}
      loading={isLoading}
      path="/product"
      id="product"
    >
      <Content isLoading={isLoading} />
    </Section>
  );
}
