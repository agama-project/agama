/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { createRoot } from "react-dom/client";

/**
 * Import PF base styles before any JSX since components coming from PF may
 * import styles dependent on variables and rules previously defined there.
 */
import "@patternfly/patternfly/dist/patternfly-base.scss";
import "@patternfly/patternfly/dist/patternfly-addons.scss";

/**
 * As JSX components might import CSS stylesheets, our styles must be imported
 * after them to preserve our overrides (e.g., PF overrides).
 *
 * Because mini-css-extract-plugin maintains the order of the imported CSS,
 * adding the overrides here ensures the overrides will be placed appropriately
 * at the end of our stylesheet when it extracts the CSS from dist/index.js
 *
 * See https://github.com/cockpit-project/starter-kit/blob/aeb81718e75b54e5d50ee450fe2abfbcfa58f5e6/src/index.js
 */
import "~/assets/styles/index.scss";
import { Bullseye, Spinner } from "@patternfly/react-core";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  // TODO: display just a simple spinner for now, later we might add something more fancy
  // or display some texts (after displaying the language switcher)
  <Bullseye>
    <Spinner size="xl" />
  </Bullseye>,
);
