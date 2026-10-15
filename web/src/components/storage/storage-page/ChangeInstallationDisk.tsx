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
import { Button, Flex } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { _ } from "~/i18n";
import { useConfigModel, useChangeTargetDrive } from "~/hooks/model/storage/config-model";
import { useCandidateDrives } from "~/hooks/model/system/storage";
import { useDevice } from "~/hooks/model/system/storage";
import type { Storage } from "~/model/system";

export default function ChangeInstallationDisk(): React.ReactNode {
  const config = useConfigModel();
  const device = useDevice(config.drives[0].name);
  const candidate = useCandidateDrives();
  const changeTargetDrive = useChangeTargetDrive();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button variant="plain" onClick={() => setIsOpen(true)}>
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          <Icon name="change_circle" />{" "}
          {
            // TRANSLATORS: offered at the foot of the list of what the
            // installation is made of: put the whole of it on a different disk.
            _("Change installation disk")
          }
        </Flex>
      </Button>
      {isOpen && (
        <DeviceSelectorModal
          title={_("Use another device")}
          tabs={["disks"]}
          selected={device}
          disks={candidate}
          onCancel={() => setIsOpen(false)}
          onConfirm={([target]: Storage.Device[]) => {
            setIsOpen(false);
            changeTargetDrive(target.name);
          }}
        />
      )}
    </>
  );
}
