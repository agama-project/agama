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
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { useProduct } from "~/context/product";
import { Section, SectionSkeleton } from "~/components/core";
import { _ } from "~/i18n";

const errorsFrom = (issues) => {
  const errors = issues.filter(i => i.severity === "error");
  return errors.map(e => ({ message: e.description }));
};

export default function ProductSection() {
  const { software } = useInstallerClient();
  const [issues, setIssues] = useState([]);
  const { selectedProduct } = useProduct();
  const { cancellablePromise } = useCancellablePromise();

  useEffect(() => {
    cancellablePromise(software.product.getIssues()).then(setIssues);
    return software.product.onIssuesChange(setIssues);
  }, [cancellablePromise, setIssues, software]);

  const Content = ({ isLoading = false }) => {
    if (isLoading) return <SectionSkeleton numRows={1} />;

    return (
      <Text>
        {selectedProduct?.name}
      </Text>
    );
  };

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
      path="/products"
    >
      <Content isLoading={isLoading} />
    </Section>
  );
}
