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

import React from "react";
import { Button, ButtonProps, Flex } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { ROOT } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Download logs button component
 *
 * A pre-configured button that downloads the installation logs archive.
 * The button is styled as a plain variant and includes a download icon.
 *
 * The download attributes (href, download filename) are always controlled
 * by this component and cannot be overridden.
 */
export default function DownloadLogsButton(
  props: Omit<ButtonProps, "onClick" | "href" | "download">,
) {
  return (
    <Button
      component="a"
      variant="plain"
      size="default"
      {...props}
      href={ROOT.logs}
      download="agama-logs.tar.gz"
    >
      <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
        <Icon name="download" /> {_("Download logs")}
      </Flex>
    </Button>
  );
}
