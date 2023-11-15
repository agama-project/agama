/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { useProduct } from "~/context/product";
import { Navigate } from "react-router-dom";
import { Page, InstallButton } from "~/components/core";
import {
  L10nSection,
  NetworkSection,
  ProductSection,
  SoftwareSection,
  StorageSection,
  UsersSection
} from "~/components/overview";
import { _ } from "~/i18n";

function Overview() {
  const { selectedProduct } = useProduct();
  const [showErrors, setShowErrors] = useState(false);

  if (selectedProduct === null) {
    return <Navigate to="/products" />;
  }

  return (
    <Page
      // TRANSLATORS: page title
      title={_("Installation Summary")}
      icon="list_alt"
      action={<InstallButton onClick={() => setShowErrors(true)} />}
    >
      <ProductSection />
      <L10nSection />
      <NetworkSection />
      <StorageSection showErrors />
      <SoftwareSection showErrors />
      <UsersSection showErrors={showErrors} />
    </Page>
  );
}

export default Overview;
