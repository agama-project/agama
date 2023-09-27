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

import React from "react";
import { Page } from "~/components/core";
import { PatternSelector } from "~/components/software";
import { _ } from "~/i18n";

function SoftwareSelectionPage() {
  return (
    // TRANSLATORS: page title
    <Page title={_("Software")} icon="apps" actionLabel={_("Back")} actionVariant="secondary">
      <h2>{_("Available Software")}</h2>
      <PatternSelector />
    </Page>
  );
}

export default SoftwareSelectionPage;
