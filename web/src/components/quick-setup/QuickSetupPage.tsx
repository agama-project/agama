/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { isEmpty } from "radashi";
import { Content } from "@patternfly/react-core";
import Page from "~/components/layout/Page";
import QuickSetupForm from "~/components/quick-setup/quick-setup-form/Form";
import { useProductInfo } from "~/hooks/model/config/product";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

import type { Product } from "~/model/system";

type IntroProps = {
  products: Product[];
  /** The product already set, when Quick setup is reopened. */
  currentProduct?: Product;
  /** Whether the product cannot change, as on a registered system. */
  isProductLocked: boolean;
};

/**
 * What the screen is for. Reopened, it says what can be done there: changing
 * the product or its mode, when possible, and adjusting the rest.
 */
const intro = ({ products, currentProduct, isProductLocked }: IntroProps) => {
  if (!currentProduct)
    return _(
      // TRANSLATORS: introduction of the Quick setup screen, at the start of a
      // new installation
      "A few choices to get started. You can review and adjust everything else before installing.",
    );

  if (!isProductLocked && products.length > 1)
    // TRANSLATORS: introduction of the Quick setup screen when reopened
    return _("Change the product or adjust the basic settings.");

  if (!isProductLocked && !isEmpty(currentProduct.modes))
    // TRANSLATORS: introduction of the Quick setup screen when reopened, for a
    // product that offers several modes (e.g. standard or immutable)
    return _("Change the product mode or adjust the basic settings.");

  // TRANSLATORS: introduction of the Quick setup screen when reopened, when the
  // product cannot change
  return _("Adjust the basic settings.");
};

/**
 * Quick setup: what every installation needs and Agama cannot guess, on one
 * screen, before the overview. Reopened later, it starts from what is set.
 *
 * It sends to the overview instead when it is reached without the user asking
 * for it while a product is set already (bsc#1260465), checked on arrival only
 * so the product reported after accepting does not cut the save short. On a
 * registered system the product cannot change, so it is only shown.
 */
export default function QuickSetupPage() {
  const currentProduct = useProductInfo();
  const { products = [] } = useSystem() ?? {};
  const { registration } = useSystemSoftware();
  const [searchParams] = useSearchParams();
  const [isNotWanted] = useState(() => !!currentProduct && searchParams.get("byUser") === null);

  if (isNotWanted) return <Navigate to={ROOT.root} />;

  return (
    <Page
      // TRANSLATORS: title of the screen asking for the basic installation
      // settings (product, location, login)
      breadcrumbs={[{ label: _("Quick setup") }]}
      unlinkSummary
    >
      <QuickSetupForm
        isProductLocked={!!registration}
        intro={
          <Content isEditorial>
            {intro({
              products,
              currentProduct: currentProduct ?? undefined,
              isProductLocked: !!registration,
            })}
          </Content>
        }
      />
    </Page>
  );
}
