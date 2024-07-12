/*
 * Copyright (c) [2022] SUSE LLC
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

import { Button } from "@patternfly/react-core";

import WifiConnectionForm from "./WifiConnectionForm";
import { _ } from "~/i18n";

/**
 * Component to render a form for connecting to a hidden Wi-Fi Network
 *
 * @param {object} props - component props
 * @param {object} props.network - a basic network object
 * @param {boolean} props.visible - whether the form should be displayed
 * @param {function} props.beforeDisplaying - callback to trigger before displaying the form
 * @param {function} props.beforeHiding - callback to trigger before hiding the form
 */
function WifiHiddenNetworkForm({ network, visible, beforeHiding, onSubmitCallback }) {
  return (
    <>
      {visible && (
        <WifiConnectionForm
          network={network}
          onCancel={beforeHiding}
          onSubmitCallback={onSubmitCallback}
        />
      )}
    </>
  );
}

export default WifiHiddenNetworkForm;
