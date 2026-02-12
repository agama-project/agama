/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { HelperText, HelperTextItem } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import ProgressReport from "~/components/core/ProgressReport";
import ProductLogo from "~/components/product/ProductLogo";
import SplitInfoLayout from "~/components/layout/SplitInfoLayout";
import { useProductInfo } from "~/hooks/model/config/product";
import { _ } from "~/i18n";

export default function InstallationProgress() {
  const product = useProductInfo();

  return (
    <Page showInstallerOptions={false} hideProgressMonitor>
      <Page.Content>
        <SplitInfoLayout
          icon="deployed_code_update"
          firstRowStart={
            <>
              <ProductLogo product={product} width="1.25em" /> {product?.name}
            </>
          }
          firstRowEnd={<ProgressReport />}
          secondRowStart={
            <HelperText>
              <HelperTextItem>{_("Installation in progress")}</HelperTextItem>
            </HelperText>
          }
        />
      </Page.Content>
    </Page>
  );
}
