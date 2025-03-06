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

import React, { useState } from "react";
import {
  ActionGroup,
  Checkbox,
  Content,
  Flex,
  Form,
  FormGroup,
  Gallery,
  Label,
  TextInput,
} from "@patternfly/react-core";
import { Page, SubtleContent } from "~/components/core";
import { useAvailableDevices } from "~/queries/storage";
import { deviceLabel } from "./utils";
import { contentDescription, filesystemLabels, typeDescription } from "./utils/device";
import { _ } from "~/i18n";

/**
 * Form for creating a LVM volume group
 */
export default function LvmPage() {
  const allDevices = useAvailableDevices();
  const [name, setName] = useState("system");
  // FIXME: decide what to store, if the device object or just its sid and type
  // the state accordingly
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [moveMountPoints, setMoveMountPoints] = useState(true);

  const updateName = (_, value) => setName(value);
  const updateSelectedDevices = (value) => {
    setSelectedDevices(
      selectedDevices.includes(value)
        ? selectedDevices.filter((d) => d !== value)
        : [...selectedDevices, value],
    );
  };

  const onSubmit = () => {
    console.log("TODO: implement the logic to be triggered when LVM form is submitted");
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("New Volume Group")}</Content>
        <SubtleContent>{_("Create a new LVM volume group")}</SubtleContent>
      </Page.Header>

      <Page.Content>
        <Form id="lvmForm" onSubmit={onSubmit}>
          <FormGroup fieldId="lvmName" label={_("Name")} isStack>
            <TextInput id="lvmName" value={name} onChange={updateName} />
          </FormGroup>
          <FormGroup label={_("Disks")} role="group" style={{ justifySelf: "stretch" }} isStack>
            <Content component="small">
              {_(
                "The needed LVM physical volumes will be created as partitions on the chosen disks, based on the sizes of the logical volumes. If you select more than one disk, the physical volumes may be distributed along several disks.",
              )}
            </Content>
            <Gallery hasGutter>
              {allDevices.map((device) => (
                <Checkbox
                  key={device.sid}
                  id={`device${device.sid}`}
                  label={<Content isEditorial>{deviceLabel(device)}</Content>}
                  description={
                    <Flex rowGap={{ default: "rowGapXs" }} columnGap={{ default: "columnGapSm" }}>
                      <SubtleContent>
                        {typeDescription(device)} {contentDescription(device)}
                      </SubtleContent>
                      {filesystemLabels(device).map((s, i) => (
                        <Label key={i} variant="outline" isCompact>
                          {s}
                        </Label>
                      ))}
                      {device.systems.map((s, i) => (
                        <Label key={i} isCompact>
                          {s}
                        </Label>
                      ))}
                    </Flex>
                  }
                  isChecked={selectedDevices.includes(device)}
                  onChange={() => updateSelectedDevices(device)}
                />
              ))}
            </Gallery>
          </FormGroup>
          <FormGroup label={_("Move mount points")} isStack>
            <Checkbox
              id="moveMountPoints"
              label={_(
                "Create logical volumes for the mount points currently configured at the selected disks",
              )}
              isChecked={moveMountPoints}
              onChange={(_, v) => setMoveMountPoints(v)}
            />
          </FormGroup>
          <ActionGroup>
            <Page.Submit form="lvmCreationForm" />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
