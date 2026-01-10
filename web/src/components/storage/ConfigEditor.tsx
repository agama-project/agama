/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { Alert, Button, DataList, Flex } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import DriveEditor from "~/components/storage/DriveEditor";
import VolumeGroupEditor from "~/components/storage/VolumeGroupEditor";
import MdRaidEditor from "~/components/storage/MdRaidEditor";
import { useReset } from "~/hooks/model/config/storage";
import ConfigureDeviceMenu from "./ConfigureDeviceMenu";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";

const NoDevicesConfiguredAlert = () => {
  const reset = useReset();
  const title = _("No devices configured yet");
  // TRANSLATORS: %s will be replaced by a "reset to default" button
  const body = _(
    "Use actions below to set up your devices or click %s to start from scratch with the default configuration.",
  );
  const [bodyStart, bodyEnd] = body.split("%s");

  return (
    <Alert title={title} variant="custom" isInline>
      {bodyStart}{" "}
      <Button variant="link" onClick={() => reset()} isInline>
        <Text isBold>
          {
            // TRANSLATORS: label for a button
            _("reset to defaults")
          }
        </Text>
      </Button>{" "}
      {bodyEnd}
    </Alert>
  );
};

export default function ConfigEditor() {
  const config = useConfigModel();
  const drives = config.drives;
  const mdRaids = config.mdRaids;
  const volumeGroups = config.volumeGroups;

  if (!drives.length && !mdRaids.length && !volumeGroups.length) {
    return <NoDevicesConfiguredAlert />;
  }

  return (
    <>
      <DataList aria-label={_("[FIXME]")} isCompact className="storage-structure">
        {volumeGroups.map((vg, i) => {
          return <VolumeGroupEditor key={`vg-${i}`} vg={vg} />;
        })}
        {mdRaids.map((_, i) => (
          <MdRaidEditor key={`md-${i}`} index={i} />
        ))}
        {drives.map((_, i) => (
          <DriveEditor key={`drive-${i}`} index={i} />
        ))}
      </DataList>
      <Flex>
        <ConfigureDeviceMenu />
      </Flex>
    </>
  );
}
