/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { Button, Card, CardBody, Flex } from "@patternfly/react-core";
import { ChangeProductOption } from "../core";
import Icon from "~/components/layout/Icon";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

export default function InstallerOptionsSection() {
  return (
    <Card variant="secondary">
      <CardBody>
        <Flex
          gap={{ default: "gapXs" }}
          direction={{ default: "column" }}
          alignItems={{ default: "alignItemsFlexStart" }}
        >
          <ChangeProductOption variant="link" showIcon />
          <Button component="a" href={ROOT.logs} variant="link" download="agama-logs.tar.gz">
            <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
              <Icon name="download" /> {_("Download logs")}
            </Flex>
          </Button>
        </Flex>
      </CardBody>
    </Card>
  );
}
