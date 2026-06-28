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

import React, { Suspense } from "react";
import { Bullseye, Content, Flex, Spinner } from "@patternfly/react-core";
import Popup from "~/components/core/Popup";
import { _ } from "~/i18n";

type ConfigDialogProps = {
  onClose: () => void;
};

// load the component and its dependencies dynamically when needed, do not
// include it in the default index.js file, the Monaco editor is huge
const ConfigEditor = React.lazy(
  () =>
    import(
      /* webpackChunkName: "config-editor" */
      "~/components/core/ConfigEditor"
    ),
);

/**
 * Dialog showing the current installation configuration in JSON format, with
 * options to copy or download the content.
 */
export default function ConfigDialog({ onClose }: ConfigDialogProps) {
  const fallback = (
    <Bullseye>
      <Spinner />
    </Bullseye>
  );

  return (
    <Popup
      isOpen
      // TRANSLATORS: dialog title
      title={_("Installation settings in JSON format")}
      onClose={onClose}
      variant="medium"
    >
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        <Content>
          {_(
            "Use this to reproduce this installation later using the installer command-line interface or the unattended mode.",
          )}
        </Content>
        <Suspense fallback={fallback}>
          <ConfigEditor />
        </Suspense>
      </Flex>

      <Popup.Actions>
        {/* TRANSLATORS: button to close the config dialog */}
        <Popup.Confirm onClick={onClose}>{_("Close")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
}
