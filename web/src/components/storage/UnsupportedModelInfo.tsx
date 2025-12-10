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
import { Alert, Button, Content, Stack, StackItem } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { useStorageModel } from "~/hooks/model/storage";
import { useReset } from "~/hooks/model/config/storage";

/**
 * Info about unsupported model.
 */
export default function UnsupportedModelInfo(): React.ReactNode {
  const model = useStorageModel();
  const reset = useReset();

  if (model) return null;

  return (
    <Alert variant="info" title={_("Unable to modify the settings")}>
      <Stack hasGutter>
        <StackItem>
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
        </StackItem>
        <StackItem>
          <Button variant="secondary" onClick={() => reset()}>
            {_("Reset to the default configuration")}
          </Button>
        </StackItem>
      </Stack>
    </Alert>
  );
}
