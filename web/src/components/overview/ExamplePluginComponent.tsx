/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { useState } from "react";
import { Button, Text } from "@patternfly/react-core";
import { Page } from "~/components/core";

/* disable translation check, this is just an example file */
/* eslint-disable i18next/no-literal-string */

/**
 * Renders an example plugin card
 */
export default function ExamplePluginComponent() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <Page.Section
      title="Example Plugin"
      description="This is an example plugin loaded from external '/plugin.js' file."
      actions={<Button onClick={() => setIsOpen(false)}>Hide</Button>}
    >
      <Text>You can safely close the card, it does not do anything. 😀</Text>
    </Page.Section>
  );
}
