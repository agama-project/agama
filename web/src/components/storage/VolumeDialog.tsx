/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { FormEvent, useReducer } from "react";
import { Alert, Button, Form, Split } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { FsField, MountPathField, SizeOptionsField } from "~/components/storage/VolumeFields";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { compact, useDebounce } from "~/utils";
import {
  DEFAULT_SIZE_UNIT,
  SIZE_METHODS,
  mountFilesystem,
  parseToBytes,
  reuseDevice,
  splitSize,
  volumeLabel,
} from "~/components/storage/utils";
import { Volume } from "~/types/storage";
import { SizeMethod } from "~/components/storage/utils";

type VolumeFormState = {
  volume: Volume;
  formData: VolumeFormData;
  errors: VolumeFormErrors;
};
type VolumeFormData = {
  minSize?: number | string;
  minSizeUnit?: string;
  maxSize?: number | string;
  maxSizeUnit?: string;
  sizeMethod: SizeMethod;
  mountPath: string;
  fsType: string;
  snapshots: boolean;
};
type VolumeFormErrors = {
  missingMountPath: string | null;
  invalidMountPath: string | null;
  existingVolume: React.ReactElement | null;
  existingTemplate: React.ReactElement | null;
  missingSize: string | null;
  missingMinSize: string | null;
  invalidMaxSize: string | null;
};

/**
 * Renders the title for the dialog.
 */
const renderTitle = (volume: Volume, volumes: Volume[]): string => {
  const isNewVolume = !volumes.includes(volume);
  const isProductDefined = volume.outline.productDefined;
  const label = volumeLabel(volume);

  if (isNewVolume && isProductDefined) return sprintf(_("Add %s file system"), label);
  if (!isNewVolume && isProductDefined) return sprintf(_("Edit %s file system"), label);

  return isNewVolume ? _("Add file system") : _("Edit file system");
};

/**
 * @component
 */
const VolumeAlert = ({ volume }: { volume: Volume }) => {
  let alert: { title: string; text: string };

  if (mountFilesystem(volume)) {
    alert = {
      // TRANSLATORS: Warning when editing a file system.
      title: _("The type and size of the file system cannot be edited."),
      // TRANSLATORS: Description of a warning. The first %s is replaced by a device name (e.g.,
      // /dev/vda) and the second %s is replaced by a mount path (e.g., /home).
      text: sprintf(
        _("The current file system on %s is selected to be mounted at %s."),
        volume.targetDevice.name,
        volume.mountPath,
      ),
    };
  } else if (reuseDevice(volume)) {
    alert = {
      // TRANSLATORS: Warning when editing a file system.
      title: _("The size of the file system cannot be edited"),
      // TRANSLATORS: Description of a warning. %s is replaced by a device name (e.g., /dev/vda).
      text: sprintf(_("The file system is allocated at the device %s."), volume.targetDevice.name),
    };
  }

  if (!alert) return null;

  return (
    <Alert variant="warning" isInline title={alert.title}>
      {alert.text}
    </Alert>
  );
};

/** @fixme Redesign *Error classes.
 *
 *  Having different *Error classes does not seem to be a good design. Note these classes do not
 *  represent an error but a helper to check and render an error. It would be a better approach to
 *  have something like a volume checker which generates errors:
 *
 *  For example:
 *
 *  const checker = new VolumeChecker(volume, volumes, templates);
 *  const error = checker.existingMountPathError();
 *  const message = error?.render(onClick);
 */
class MissingMountPathError {
  mountPath: string;

  constructor(mountPath: string) {
    this.mountPath = mountPath;
  }

  check(): boolean {
    return this.mountPath.length === 0;
  }

  render(): string {
    return _("A mount point is required");
  }
}

class InvalidMountPathError {
  mountPath: string;

  constructor(mountPath: string) {
    this.mountPath = mountPath;
  }

  check(): boolean {
    const regex = /^swap$|^\/$|^(\/[^/\s]+([^/]*[^/\s])*)+$/;
    return !regex.test(this.mountPath);
  }

  render(): string {
    return _("The mount point is invalid");
  }
}

class MissingSizeError {
  sizeMethod: SizeMethod;
  size: string | number;

  constructor(sizeMethod: SizeMethod, size: string | number) {
    this.sizeMethod = sizeMethod;
    this.size = size;
  }

  check(): boolean {
    return this.sizeMethod === SIZE_METHODS.MANUAL && !this.size;
  }

  render(): string {
    return _("A size value is required");
  }
}

class MissingMinSizeError {
  sizeMethod: SizeMethod;
  minSize: string | number;

  constructor(sizeMethod: SizeMethod, minSize: string | number) {
    this.sizeMethod = sizeMethod;
    this.minSize = minSize;
  }

  check(): boolean {
    return this.sizeMethod === SIZE_METHODS.RANGE && !this.minSize;
  }

  render(): string {
    return _("Minimum size is required");
  }
}

class InvalidMaxSizeError {
  sizeMethod: SizeMethod;
  minSize: string | number;
  maxSize: string | number;

  constructor(sizeMethod: SizeMethod, minSize: string | number, maxSize: string | number) {
    this.sizeMethod = sizeMethod;
    this.minSize = minSize;
    this.maxSize = maxSize;
  }

  check(): boolean {
    return (
      this.sizeMethod === SIZE_METHODS.RANGE && this.maxSize !== -1 && this.maxSize <= this.minSize
    );
  }

  render(): string {
    return _("Maximum must be greater than minimum");
  }
}

class ExistingVolumeError {
  mountPath: string;
  volumes: Volume[];

  constructor(mountPath: string, volumes: Volume[]) {
    this.mountPath = mountPath;
    this.volumes = volumes;
  }

  findVolume(): Volume | undefined {
    return this.volumes.find((t) => t.mountPath === this.mountPath);
  }

  check(): boolean {
    return this.mountPath.length && this.findVolume() !== undefined;
  }

  render(onClick: (volume: Volume) => void): React.ReactElement {
    const volume = this.findVolume();
    const path = this.mountPath === "/" ? "root" : this.mountPath;

    return (
      <Split hasGutter>
        <span>{sprintf(_("There is already a file system for %s."), path)}</span>
        <Button variant="link" isInline onClick={() => onClick(volume)}>
          {_("Do you want to edit it?")}
        </Button>
      </Split>
    );
  }
}

class ExistingTemplateError {
  mountPath: string;
  templates: Volume[];

  constructor(mountPath: string, templates: Volume[]) {
    this.mountPath = mountPath;
    this.templates = templates;
  }

  findTemplate(): Volume | undefined {
    return this.templates.find((t) => t.mountPath === this.mountPath);
  }

  check(): boolean {
    return this.mountPath.length && this.findTemplate() !== undefined;
  }

  render(onClick: (template: Volume) => void): React.ReactElement {
    const template = this.findTemplate();
    const path = this.mountPath === "/" ? "root" : this.mountPath;

    return (
      <Split hasGutter>
        <span>{sprintf(_("There is a predefined file system for %s."), path)}</span>
        <Button variant="link" isInline onClick={() => onClick(template)}>
          {_("Do you want to add it?")}
        </Button>
      </Split>
    );
  }
}

/**
 * Error if the mount path is missing.
 */
const missingMountPathError = (mountPath: string): string | null => {
  const error = new MissingMountPathError(mountPath);
  return error.check() ? error.render() : null;
};

/**
 * Error if the mount path is not valid.
 */
const invalidMountPathError = (mountPath: string): string | null => {
  const error = new InvalidMountPathError(mountPath);
  return error.check() ? error.render() : null;
};

/**
 * Error if the size is missing.
 */
const missingSizeError = (sizeMethod: SizeMethod, size: string | number): string | null => {
  const error = new MissingSizeError(sizeMethod, size);
  return error.check() ? error.render() : null;
};

/**
 * Error if the min size is missing.
 */
const missingMinSizeError = (sizeMethod: SizeMethod, minSize: string | number): string | null => {
  const error = new MissingMinSizeError(sizeMethod, minSize);
  return error.check() ? error.render() : null;
};

/**
 * Error if the max size is not valid.
 */
const invalidMaxSizeError = (
  sizeMethod: SizeMethod,
  minSize: string | number,
  maxSize: string | number,
): string | null => {
  const error = new InvalidMaxSizeError(sizeMethod, minSize, maxSize);
  return error.check() ? error.render() : null;
};

/**
 * Error if the given mount path exists in the list of volumes.
 */
const existingVolumeError = (
  mountPath: string,
  volumes: Volume[],
  onClick: (volume: Volume) => void,
): React.ReactElement | null => {
  const error = new ExistingVolumeError(mountPath, volumes);
  return error.check() ? error.render(onClick) : null;
};

/**
 * Error if the given mount path exists in the list of templates.
 */
const existingTemplateError = (
  mountPath: string,
  templates: Volume[],
  onClick: (template: Volume) => void,
): React.ReactElement | null => {
  const error = new ExistingTemplateError(mountPath, templates);
  return error.check() ? error.render(onClick) : null;
};

/**
 * Checks whether there is any error.
 */
const anyError = (errors: VolumeFormErrors): boolean => {
  return compact(Object.values(errors)).length > 0;
};

/**
 * Remove leftover trailing slash.
 */
const sanitizeMountPath = (mountPath: string): string => {
  if (mountPath === "/") return mountPath;

  return mountPath.replace(/\/$/, "");
};

/**
 * Creates a new storage volume object based on given params.
 */
const createUpdatedVolume = (volume: Volume, formData: VolumeFormData): Volume => {
  let sizeAttrs = {};
  const minSize = parseToBytes(`${formData.minSize} ${formData.minSizeUnit}`);
  const maxSize = parseToBytes(`${formData.maxSize} ${formData.maxSizeUnit}`);

  switch (formData.sizeMethod) {
    case SIZE_METHODS.AUTO:
      sizeAttrs = { minSize: undefined, maxSize: undefined, autoSize: true };
      break;
    case SIZE_METHODS.MANUAL:
      sizeAttrs = { minSize, maxSize: minSize, autoSize: false };
      break;
    case SIZE_METHODS.RANGE:
      sizeAttrs = { minSize, maxSize: formData.maxSize ? maxSize : undefined, autoSize: false };
      break;
  }

  const { fsType, snapshots } = formData;
  const mountPath = sanitizeMountPath(formData.mountPath);

  return { ...volume, mountPath, ...sizeAttrs, fsType, snapshots };
};

/**
 * Form-related helper for guessing the size method for given volume
 */
const sizeMethodFor = (volume: Volume): SizeMethod => {
  const { autoSize, minSize, maxSize } = volume;

  if (autoSize) {
    return SIZE_METHODS.AUTO;
  } else if (minSize !== maxSize) {
    return SIZE_METHODS.RANGE;
  } else {
    return SIZE_METHODS.MANUAL;
  }
};

/**
 * Form-related helper for preparing data based on given volume
 */
const prepareFormData = (volume: Volume): VolumeFormData => {
  const { size: minSize = "", unit: minSizeUnit = DEFAULT_SIZE_UNIT } = splitSize(volume.minSize);
  const { size: maxSize = "", unit: maxSizeUnit = minSizeUnit || DEFAULT_SIZE_UNIT } = splitSize(
    volume.maxSize,
  );

  return {
    minSize,
    minSizeUnit,
    maxSize,
    maxSizeUnit,
    sizeMethod: sizeMethodFor(volume),
    mountPath: volume.mountPath,
    fsType: volume.fsType,
    snapshots: volume.snapshots,
  };
};

/**
 * Possible errors from the form data.
 */
const prepareErrors = (): VolumeFormErrors => {
  return {
    missingMountPath: null,
    invalidMountPath: null,
    existingVolume: null,
    existingTemplate: null,
    missingSize: null,
    missingMinSize: null,
    invalidMaxSize: null,
  };
};

/**
 * Initializer function for the React#useReducer used in the {@link VolumesForm}
 *
 * @param volume - a storage volume object
 */
const createInitialState = (volume: Volume): VolumeFormState => {
  const formData = prepareFormData(volume);
  const errors = prepareErrors();

  return { volume, formData, errors };
};

/**
 * The VolumeForm reducer.
 */
const reducer = (state: VolumeFormState, action: { type: string; payload: any }) => {
  const { type, payload } = action;

  switch (type) {
    case "CHANGE_VOLUME": {
      return createInitialState(payload.volume);
    }

    case "UPDATE_DATA": {
      return {
        ...state,
        formData: {
          ...state.formData,
          ...payload,
        },
      };
    }

    case "SET_ERRORS": {
      const errors = { ...state.errors, ...payload };
      return { ...state, errors };
    }

    default: {
      return state;
    }
  }
};

export type VolumeDialogProps = {
  volume: Volume;
  volumes: Volume[];
  templates: Volume[];
  isOpen?: boolean;
  onCancel: () => void;
  onAccept: (volume: Volume) => void;
};

/**
 * Renders a dialog that allows the user to add or edit a file system.
 * @component
 */
export default function VolumeDialog({
  volume: currentVolume,
  volumes,
  templates,
  isOpen,
  onCancel,
  onAccept,
}: VolumeDialogProps) {
  const [state, dispatch]: [VolumeFormState, (action: any) => void] = useReducer(
    reducer,
    currentVolume,
    createInitialState,
  );

  const delayed: Function = useDebounce((f) => f(), 1000);

  const changeVolume: (volume: Volume) => void = (volume) => {
    dispatch({ type: "CHANGE_VOLUME", payload: { volume } });
  };

  const updateData: (data: object) => void = (data): void =>
    dispatch({ type: "UPDATE_DATA", payload: data });

  const updateErrors: (errors: object) => void = (errors): void =>
    dispatch({ type: "SET_ERRORS", payload: errors });

  const mountPathError: () => string | React.ReactElement = () => {
    const { missingMountPath, invalidMountPath, existingVolume, existingTemplate } = state.errors;
    return missingMountPath || invalidMountPath || existingVolume || existingTemplate;
  };

  const sizeErrors: () => object = () => {
    return {
      size: state.errors.missingSize,
      minSize: state.errors.missingMinSize,
      maxSize: state.errors.invalidMaxSize,
    };
  };

  const disableWidgets: () => boolean = () => {
    const { existingVolume, existingTemplate } = state.errors;
    return existingVolume !== null || existingTemplate !== null;
  };

  const isMountPathEditable: () => boolean = () => {
    const isNewVolume = !volumes.includes(state.volume);
    const isPredefined = state.volume.outline.productDefined;
    return isNewVolume && !isPredefined;
  };

  const changeMountPath: (mountPath: string) => void = (mountPath) => {
    // Reset current errors.
    const errors = {
      missingMountPath: null,
      invalidMountPath: null,
      existingVolume: null,
      existingTemplate: null,
    };
    updateErrors(errors);

    delayed(() => {
      // Reevaluate in a delayed way.
      const errors = {
        existingVolume: existingVolumeError(mountPath, volumes, changeVolume),
        existingTemplate: existingTemplateError(mountPath, templates, changeVolume),
      };
      updateErrors(errors);
    });

    updateData({ mountPath });
  };

  const changeSizeOptions: (data: object) => void = (data) => {
    // Reset errors.
    const errors = {
      missingSize: null,
      missingMinSize: null,
      invalidMaxSize: null,
    };
    updateErrors(errors);
    updateData(data);
  };

  const submitForm: (e: FormEvent) => void = (e) => {
    e.preventDefault();
    const { volume: originalVolume, formData } = state;
    const volume = createUpdatedVolume(originalVolume, formData);

    const checkMountPath = isMountPathEditable();

    const errors = {
      missingMountPath: checkMountPath ? missingMountPathError(volume.mountPath) : null,
      invalidMountPath: checkMountPath ? invalidMountPathError(volume.mountPath) : null,
      existingVolume: checkMountPath
        ? existingVolumeError(volume.mountPath, volumes, changeVolume)
        : null,
      existingTemplate: checkMountPath
        ? existingTemplateError(volume.mountPath, templates, changeVolume)
        : null,
      missingSize: missingSizeError(formData.sizeMethod, volume.minSize),
      missingMinSize: missingMinSizeError(formData.sizeMethod, volume.minSize),
      invalidMaxSize: invalidMaxSizeError(formData.sizeMethod, volume.minSize, volume.maxSize),
    };

    anyError(errors) ? updateErrors(errors) : onAccept(volume);
  };

  const title = renderTitle(state.volume, volumes);
  const { fsType, mountPath } = state.formData;
  const isDisabled = disableWidgets();
  const isFsFieldDisabled = isDisabled || mountFilesystem(state.volume);
  const isSizeFieldDisabled = isDisabled || reuseDevice(state.volume);

  return (
    /** @fixme blockSize medium is too big and small is too small. */
    <Popup title={title} isOpen={isOpen} blockSize="medium" inlineSize="medium">
      <Form id="volume-form" onSubmit={submitForm}>
        <VolumeAlert volume={state.volume} />
        <MountPathField
          value={mountPath}
          isReadOnly={!isMountPathEditable()}
          onChange={changeMountPath}
          error={mountPathError()}
        />
        <FsField
          value={fsType}
          volume={state.volume}
          isDisabled={isFsFieldDisabled}
          onChange={updateData}
        />
        <SizeOptionsField
          {...state}
          errors={sizeErrors()}
          isDisabled={isSizeFieldDisabled}
          onChange={changeSizeOptions}
        />
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="volume-form" type="submit" isDisabled={isDisabled}>
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
