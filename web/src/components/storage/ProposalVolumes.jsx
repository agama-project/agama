/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

// cspell:ignore filesize

import React, { useState } from "react";
import {
  Dropdown, DropdownToggle, DropdownItem,
  Form, FormGroup, FormSelect, FormSelectOption,
  Skeleton,
  TextInput,
  Toolbar, ToolbarContent, ToolbarItem
} from "@patternfly/react-core";
import { TableComposable, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { filesize } from "filesize";

import { Em, If, Popup, RowActions } from '~/components/core';
import { Icon } from '~/components/layout';
import { noop } from "~/utils";

const sizeText = (size) => {
  if (size === -1) return "Unlimited";

  return filesize(size, { base: 2 });
};

const VolumeForm = ({ id, templates, onSubmit }) => {
  const [volume, setVolume] = useState(templates[0]);

  const changeVolume = (mountPoint) => {
    const volume = templates.find(t => t.mountPoint === mountPoint);
    setVolume(volume);
  };

  const submitForm = (e) => {
    e.preventDefault();
    onSubmit(volume);
  };

  const volumeOptions = templates.map((template, index) => (
    <FormSelectOption key={index} value={template.mountPoint} label={template.mountPoint} />
  ));

  return (
    <Form id={id} onSubmit={submitForm}>
      <FormGroup fieldId="mountPoint" label="Mount point">
        <FormSelect
          id="mountPoint"
          aria-label="mount point"
          value={volume.mountPoint}
          onChange={changeVolume}
        >
          {volumeOptions}
        </FormSelect>
      </FormGroup>
      <FormGroup
        fieldId="fsType"
        label="File system type"
      >
        <TextInput
          id="fsType"
          name="fsType"
          aria-label="Fs type"
          value={volume.fsType}
          label="File system type"
          isDisabled
        />
      </FormGroup>
      <FormGroup
        fieldId="minSize"
        label="Minimum size"
      >
        <TextInput
          id="minSize"
          name="minSize"
          aria-label="Min size"
          value={sizeText(volume.minSize)}
          label="Minimum Size"
          isDisabled
        />
      </FormGroup>
      <FormGroup
        fieldId="maxSize"
        label="Maximum size"
      >
        <TextInput
          id="maxSize"
          name="maxSize"
          aria-label="Max size"
          value={sizeText(volume.maxSize)}
          label="Maximum Size"
          isDisabled
        />
      </FormGroup>
    </Form>
  );
};

const GeneralActions = ({ volumes, templates, onVolumesChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (volume) => {
    closeForm();

    const newVolumes = [...volumes, volume];
    onVolumesChange(newVolumes);
  };

  const reset = () => onVolumesChange([]);

  const toggleActions = (status) => setIsOpen(status);

  const closeActions = () => setIsOpen(false);

  const Action = ({ children, ...props }) => (
    <DropdownItem component="button" {...props}>{children}</DropdownItem>
  );

  return (
    <>
      <Dropdown
        isOpen={isOpen}
        onSelect={closeActions}
        dropdownItems={[
          <Action
            key="reset"
            onClick={reset}
          >
            Reset to defaults
          </Action>,
          <Action
            key="add"
            isDisabled={templates.length === 0}
            onClick={openForm}
          >
            Add file system
          </Action>
        ]}
        toggle={
          <DropdownToggle toggleVariant="primary" onToggle={toggleActions}>
            Actions
          </DropdownToggle>
        }
      />
      <Popup aria-label="Add file system" title="Add file system" isOpen={isFormOpen}>
        <VolumeForm
          id="addVolumeForm"
          templates={templates}
          onSubmit={acceptForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="addVolumeForm" type="submit">Accept</Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </>
  );
};

const VolumesTable = ({ volumes, onVolumesChange, isLoading }) => {
  const columns = {
    mountPoint: "At",
    details: "Details",
    size: "Size limits",
    actions: "Actions"
  };

  const VolumeRow = ({ id, volume, isLoading }) => {
    const SizeLimits = ({ volume }) => {
      const limits = `${sizeText(volume.minSize)} - ${sizeText(volume.maxSize)}`;
      const isAuto = volume.adaptiveSizes && !volume.fixedSizeLimits;

      const autoModeIcon = <Icon name="auto_mode" size={12} />;

      return (
        <div className="split">
          <span>{limits}</span>
          <If condition={isAuto} then={<Em icon={autoModeIcon}>auto-calculated</Em>} />
        </div>
      );
    };

    const Details = ({ volume }) => {
      const isLv = volume.deviceType === "lvm_lv";
      const hasSnapshots = volume.fsType === "Btrfs" && volume.snapshots;

      const text = `${volume.fsType} ${isLv ? "logical volume" : "partition"}`;
      const lockIcon = <Icon name="lock" size={12} />;
      const snapshotsIcon = <Icon name="add_a_photo" size={12} />;

      return (
        <div className="split">
          <span>{text}</span>
          <If condition={volume.encrypted} then={<Em icon={lockIcon}>encrypted</Em>} />
          <If condition={hasSnapshots} then={<Em icon={snapshotsIcon}>with snapshots</Em>} />
        </div>
      );
    };

    const VolumeActions = ({ id, volume }) => {
      const removeVolume = (volume) => {
        const newVolumes = volumes.filter(v => v.mountPoint !== volume.mountPoint);
        onVolumesChange(newVolumes);
      };

      const actions = () => {
        const actions = {
          delete: {
            title: "Delete",
            onClick: () => removeVolume(volume),
            className: "danger-action"
          }
        };

        if (volume.optional)
          return [actions.delete];
        else
          return [];
      };

      const currentActions = actions();

      if (currentActions.length === 0) return null;

      return <RowActions actions={currentActions} id={id} />;
    };

    if (isLoading) {
      return (
        <Tr>
          <Td colSpan={4}><Skeleton /></Td>
        </Tr>
      );
    }

    return (
      <Tr>
        <Td dataLabel={columns.mountPoint}>{volume.mountPoint}</Td>
        <Td dataLabel={columns.details}><Details volume={volume} /></Td>
        <Td dataLabel={columns.size}><SizeLimits volume={volume} /></Td>
        <Td isActionCell>
          <VolumeActions volume={volume} id={`actions-for-volume${id}`} />
        </Td>
      </Tr>
    );
  };

  const VolumesContent = ({ volumes, isLoading }) => {
    if (volumes.length === 0 && isLoading) return <VolumeRow isLoading />;

    return volumes.map((volume, index) => {
      return (
        <VolumeRow
          key={`volume${index}`}
          id={index}
          volume={volume}
          isLoading={isLoading}
        />
      );
    });
  };

  return (
    <TableComposable aria-label="Simple table" variant="compact" borders>
      <Thead>
        <Tr>
          <Th>{columns.mountPoint}</Th>
          <Th>{columns.details}</Th>
          <Th>{columns.size}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <VolumesContent volumes={volumes} isLoading={isLoading} />
      </Tbody>
    </TableComposable>
  );
};

export default function ProposalVolumes({
  volumes = [],
  templates = [],
  onChange = noop,
  isLoading = false
}) {
  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            File systems to create in your system
          </ToolbarItem>
          <ToolbarItem alignment={{ default: "alignRight" }}>
            <GeneralActions
              volumes={volumes}
              templates={templates}
              onVolumesChange={onChange}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      <VolumesTable
        volumes={volumes}
        onVolumesChange={onChange}
        isLoading={isLoading}
      />
    </>
  );
}
