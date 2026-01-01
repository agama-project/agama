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

import React, { useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ActionGroup,
  Content,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Stack,
} from "@patternfly/react-core";
import { Page } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import { useAddFilesystem } from "~/hooks/storage/filesystem";
import { useModel } from "~/hooks/storage/model";
import { useDevices } from "~/queries/storage";
import { data, model, StorageDevice } from "~/types/storage";
import { deviceBaseName } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { STORAGE as PATHS } from "~/routes/paths";
import {
  NO_VALUE,
  REUSE_FILESYSTEM,
  useMountPointError,
  useUnusedMountPoints,
  useErrorsHandler,
  buildFilesystemConfig,
  extractFilesystemValue,
  mountPointSelectOptions,
  useAutoRefreshFilesystem,
} from "~/components/storage/shared/device-config-logic";
import {
  FilesystemLabel,
  FilesystemSelect,
  MountPointField,
} from "~/components/storage/shared/device-config-components";
import { compact } from "~/utils";

type DeviceModel = model.Drive | model.MdRaid;
type FormValue = {
  mountPoint: string;
  filesystem: string;
  filesystemLabel: string;
};

function toData(value: FormValue): data.Formattable {
  const filesystem = buildFilesystemConfig(
    value.filesystem,
    value.filesystemLabel,
    true // Can reuse filesystem
  );

  return {
    mountPath: value.mountPoint,
    filesystem: filesystem,
  };
}

function toFormValue(deviceModel: DeviceModel): FormValue {
  const mountPoint = deviceModel.mountPath || NO_VALUE;
  const filesystem = extractFilesystemValue(deviceModel.filesystem, true);
  const filesystemLabel = deviceModel.filesystem?.label || NO_VALUE;

  return { mountPoint, filesystem, filesystemLabel };
}

function useDeviceModel(): DeviceModel {
  const { list, listIndex } = useParams();
  const model = useModel({ suspense: true });
  return model[list].at(listIndex);
}

function useDevice(): StorageDevice {
  const deviceModel = useDeviceModel();
  const devices = useDevices("system", { suspense: true });
  return devices.find((d) => d.name === deviceModel.name);
}

function useCurrentFilesystem(): string | null {
  const device = useDevice();
  return device?.filesystem?.type || null;
}

function useInitialFormValue(): FormValue | null {
  const deviceModel = useDeviceModel();
  return React.useMemo(() => (deviceModel ? toFormValue(deviceModel) : null), [deviceModel]);
}

function useErrors(value: FormValue) {
  const deviceModel = useDeviceModel();
  const mountPointError = useMountPointError(value.mountPoint, deviceModel?.mountPath);
  const errors = compact([mountPointError]);
  return useErrorsHandler(errors);
}

export default function FormattableDevicePage() {
  const navigate = useNavigate();
  const headingId = useId();
  const [mountPoint, setMountPoint] = React.useState(NO_VALUE);
  const [filesystem, setFilesystem] = React.useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = React.useState(NO_VALUE);
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = React.useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, filesystem, filesystemLabel };
  const { errors, getVisibleError } = useErrors(value);

  const device = useDeviceModel();
  const systemDevice = useDevice();
  const unusedMountPoints = useUnusedMountPoints(device?.mountPath);
  const addFilesystem = useAddFilesystem();
  const currentFilesystem = useCurrentFilesystem();

  // Initialize form values
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setFilesystem(initialValue.filesystem);
      setFilesystemLabel(initialValue.filesystemLabel);
    }
  }, [initialValue]);

  const refreshFilesystemHandler = React.useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem, setFilesystem],
  );

  useAutoRefreshFilesystem(
    refreshFilesystemHandler,
    mountPoint,
    autoRefreshFilesystem,
    () => currentFilesystem,
  );

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setAutoRefreshFilesystem(true);
      setMountPoint(value);
    }
  };

  const changeFilesystem = (value: string) => {
    setAutoRefreshFilesystem(false);
    setFilesystem(value);
  };

  const onSubmit = () => {
    const data = toData(value);
    const { list, listIndex } = device;
    addFilesystem(list, listIndex, data);
    navigate(PATHS.root);
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;
  const showLabel = filesystem !== NO_VALUE && filesystem !== REUSE_FILESYSTEM;

  return (
    <Page id="formattablePage">
      <Page.Header>
        <Content component="h2" id={headingId}>
          {sprintf(_("Configure device %s"), device.name)}
        </Content>
      </Page.Header>

      <Page.Content>
        <Form id="formattableForm" aria-labelledby={headingId} onSubmit={onSubmit}>
          <Stack hasGutter>
            <MountPointField
              value={mountPoint}
              options={mountPointSelectOptions(unusedMountPoints)}
              error={mountPointError}
              onChange={changeMountPoint}
              SelectComponent={SelectTypeaheadCreatable}
            />

            <FormGroup>
              <Flex>
                <FlexItem>
                  <FormGroup fieldId="fileSystem" label={_("File system")}>
                    <FilesystemSelect
                      id="fileSystem"
                      value={filesystem}
                      mountPoint={usedMountPt}
                      currentFilesystem={currentFilesystem}
                      canReuse={true}
                      deviceName={systemDevice.name}
                      reuseDescription={sprintf(
                        _("Do not format %s and keep the data"),
                        deviceBaseName(systemDevice, true)
                      )}
                      onChange={changeFilesystem}
                    />
                  </FormGroup>
                </FlexItem>
                {showLabel && (
                  <FlexItem>
                    <FormGroup fieldId="fileSystemLabel" label={_("Label")}>
                      <FilesystemLabel
                        id="fileSystemLabel"
                        value={filesystemLabel}
                        onChange={setFilesystemLabel}
                      />
                    </FormGroup>
                  </FlexItem>
                )}
              </Flex>
            </FormGroup>

            <ActionGroup>
              <Page.Submit isDisabled={!isFormValid} form="formattableForm" />
              <Page.Cancel />
            </ActionGroup>
          </Stack>
        </Form>
      </Page.Content>
    </Page>
  );
}
