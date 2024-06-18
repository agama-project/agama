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

import React from "react";
import { useProduct } from "~/context/product";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import ProgressReport from "./ProgressReport";
import SimpleLayout from "~/SimpleLayout";

function InstallationProgress() {
  const { selectedProduct } = useProduct();

  if (!selectedProduct) {
    return;
  }

  // TRANSLATORS: %s is replaced by a product name (e.g., openSUSE Tumbleweed)
  const title = sprintf(_("Installing %s, please wait ..."), selectedProduct.name);
  return (
    <SimpleLayout showOutlet={false} showInstallerOptions={false}>
      <ProgressReport title={title} />
    </SimpleLayout>
  );
}

export default InstallationProgress;
