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
import { useConfigModel } from "~/queries/storage/config-model";
import { useResetConfigMutation } from "~/queries/storage";

/**
 * Info about unsupported model.
 */
export default function UnsupportedModelInfo(): React.ReactNode {
  const model = useConfigModel({ suspense: true });
  const { mutate: reset } = useResetConfigMutation();

  if (model) return null;

  return (
    <Alert variant="info" title={_("Unknown storage settings")}>
      <Stack hasGutter>
        <StackItem>
          <Content component="p">
            {_(
              "The current storage settings cannot be edited. Do you want to reset to the default settings?",
            )}
          </Content>
        </StackItem>
        <StackItem>
          <Button variant="secondary" onClick={() => reset()}>
            {_("Reset")}
          </Button>
        </StackItem>
      </Stack>
    </Alert>
  );
}
