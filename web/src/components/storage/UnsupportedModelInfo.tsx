/*
 * Copyright (c) [2025] SUSE LLC
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
import { Content } from "@patternfly/react-core";
import AlertWithDetailsPopup from "~/components/core/AlertWithDetailsPopup";
import Popup from "~/components/core/Popup";
import { _ } from "~/i18n";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useReset } from "~/hooks/model/config/storage";

/**
 * Info about unsupported model.
 *
 * One line saying the settings cannot be changed here. What can be done about
 * it, including starting over from the default configuration, is in a popup
 * one action away, as with every other report on the storage page.
 */
export default function UnsupportedModelInfo(): React.ReactNode {
  const config = useConfigModel();
  const reset = useReset();

  if (config) return null;

  return (
    <AlertWithDetailsPopup
      variant="info"
      // TRANSLATORS: reported at the top of the storage page when the storage
      // configuration uses features this interface cannot edit.
      title={_("Unable to modify the settings.")}
      // TRANSLATORS: opens a popup with what can be done about a storage
      // configuration this interface cannot edit.
      actionLabel={_("See options")}
      // TRANSLATORS: the full name of the "See options" action, read by screen
      // readers. It must start with the same words as the translation of "See
      // options", so that people using speech input can say what they see.
      actionAriaLabel={_("See options for the unsupported configuration")}
      // TRANSLATORS: title of the popup about a storage configuration this
      // interface cannot edit.
      popupTitle={_("Unsupported configuration")}
      popupActions={
        <Popup.SecondaryAction onClick={() => reset()}>
          {_("Reset to the default configuration")}
        </Popup.SecondaryAction>
      }
    >
      <Content component="p">
        {_(
          "The storage configuration is valid (see result below) but uses elements not supported by this interface.",
        )}
      </Content>
      <Content component="p">
        {_(
          "You can proceed to install with the current settings or you may want to discard the configuration and start from scratch with a simple one.",
        )}
      </Content>
    </AlertWithDetailsPopup>
  );
}
