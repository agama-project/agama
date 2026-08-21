/*
 * Copyright (c) [2025-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { Navigate } from "react-router";
import { Content, Divider, Flex, Grid, GridItem, Stack } from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import ProgressBackdrop from "~/components/core/ProgressBackdrop";
import Text from "~/components/core/Text";
import Page from "~/components/layout/Page";
import MissingProductState from "~/components/product/MissingProductState";
import InstallButton from "~/components/overview/InstallButton";
import InstallationSettings from "~/components/overview/InstallationSettings";
import SystemInformationSection from "~/components/overview/SystemInformationSection";
import { useProductInfo } from "~/hooks/model/config/product";
import { useIssues } from "~/hooks/model/issue";
import { PRODUCT } from "~/routes/paths";
import { _ } from "~/i18n";

import type { Product } from "~/model/system";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Introduction to the page, telling what is expected from the user and where
 * to find the button that starts the installation.
 */
const PageIntro = () => (
  <>
    <div>
      <Content isEditorial>
        {
          // TRANSLATORS: Introductory text shown on the overview page
          _("Take a moment to review the installation settings below and adjust them as needed.")
        }
      </Content>
      <Content className={textStyles.textColorSubtle}>
        <Interpolate
          sentence={_(
            // TRANSLATORS: This hint helps users locate the install button. Text inside
            // square brackets [] appears in bold. Keep brackets for proper formatting.
            "When ready, click on the [install] button at the end of the page.",
          )}
        >
          {(text) => <Text isBold>{text}</Text>}
        </Interpolate>
      </Content>
    </div>
    <Divider />
  </>
);

/**
 * Settings to review before installing, together with the button that starts
 * the installation.
 */
const InstallationReview = ({ product }: { product: Product }) => (
  <Stack hasGutter>
    <div style={{ flex: 1 }}>
      <InstallationSettings />
    </div>
    <InstallButton product={product} />
  </Stack>
);

/**
 * Empty state shown when the product to install was not found.
 *
 * While the product is being looked for, it reports what is being done the
 * same way pages do. That is mounted here rather than on the page so it only
 * ever happens in this situation: doing it at page level would cover the
 * overview on every software operation, including those the user can carry on
 * working through. Here there is nothing to work on until the product turns
 * up.
 *
 * Screens already reporting this at page level, such as the software one, use
 * `MissingProductState` directly, so that only one of them is ever waiting on
 * the same operation.
 */
const ProductNotFound = () => (
  <>
    <MissingProductState
      // TRANSLATORS: empty state title when the product to install was not found
      title={_("Product not found")}
      description={
        // TRANSLATORS: shown when the product to install was not found
        _(
          "The product was not found in the repositories so it is not possible to proceed with the installation.",
        )
      }
    />
    <ProgressBackdrop scope="software" />
  </>
);

const OverviewPageContent = ({ product }: { product: Product }) => {
  const issues = useIssues();
  const missingProduct = issues.some((i) => i.class === "missing_product");

  return (
    <Page
      hideSummaryLink
      // TRANSLATORS: Breadcrumb item for the main page, where the whole
      // installation can be reviewed.
      breadcrumbs={[{ label: _("Installation") }]}
    >
      <Page.Content>
        <Flex gap={{ default: "gapMd" }} direction={{ default: "column" }}>
          {/* Nothing to review nor to install, but the system is still worth showing. */}
          {!missingProduct && <PageIntro />}
          <Grid hasGutter>
            <GridItem sm={12} md={8}>
              {missingProduct ? <ProductNotFound /> : <InstallationReview product={product} />}
            </GridItem>
            <GridItem sm={12} md={4}>
              <SystemInformationSection />
            </GridItem>
          </Grid>
        </Flex>
      </Page.Content>
    </Page>
  );
};

export default function OverviewPage() {
  const product = useProductInfo();

  if (!product) {
    return <Navigate to={PRODUCT.root} />;
  }

  return <OverviewPageContent product={product} />;
}
