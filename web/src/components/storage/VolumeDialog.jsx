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

// @ts-check

import React, { useReducer } from "react";
import { Button, Form } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { compact, useDebounce } from "~/utils";
import {
  DEFAULT_SIZE_UNIT, SIZE_METHODS, parseToBytes, splitSize
} from '~/components/storage/utils';
import { FsField, MountPathField, SizeOptionsField } from "~/components/storage/VolumeFields";
import { Popup } from '~/components/core';

/**
 * @typedef {import ("~/client/storage").Volume} Volume
 * @typedef {import("~/components/storage/utils").SizeMethod} SizeMethod
 *
 * @typedef {object} VolumeFormState
 * @property {Volume} volume
 * @property {VolumeFormData} formData
 * @property {VolumeFormErrors} errors
 *
 * @typedef {object} VolumeFormData
 * @property {number|string} [size]
 * @property {string} [sizeUnit]
 * @property {number|string} [minSize]
 * @property {string} [minSizeUnit]
 * @property {number|string} [maxSize]
 * @property {string} [maxSizeUnit]
 * @property {SizeMethod} sizeMethod
 * @property {string} mountPath
 * @property {string} fsType
 * @property {boolean} snapshots
 *
 * @typedef {object} VolumeFormErrors
 * @property {string|null} missingMountPath
 * @property {string|null} invalidMountPath
 * @property {React.ReactElement|null} existingVolume
 * @property {React.ReactElement|null} existingTemplate
 * @property {string|null} missingSize
 * @property {string|null} missingMinSize
 * @property {string|null} invalidMaxSize
 *
 * @typedef {object} VolumeDialogProps
 * @property {Volume} volume
 * @property {Volume[]} volumes
 * @property {Volume[]} templates
 * @property {boolean} [isOpen=false]
 * @property {() => void} onCancel
 * @property {(volume: Volume) => void} onAccept
 */

/**
 * Renders the title for the dialog.
 * @function
 *
 * @param {Volume} volume
 * @param {Volume[]} volumes
 * @returns {string}
 */
const renderTitle = (volume, volumes) => {
  const isNewVolume = !volumes.includes(volume);
  const isProductDefined = volume.outline.productDefined;
  const mountPath = volume.mountPath === "/" ? "root" : volume.mountPath;

  if (isNewVolume && isProductDefined) return sprintf(_("Add %s file system"), mountPath);
  if (!isNewVolume && isProductDefined) return sprintf(_("Edit %s file system"), mountPath);

  return isNewVolume ? _("Add file system") : _("Edit file system");
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
  /**
   * @constructor
   * @param {string} mountPath
   */
  constructor(mountPath) {
    this.mountPath = mountPath;
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    return this.mountPath.length === 0;
  }

  /**
   * @method
   * @returns {String}
   */
  render() {
    return _("A mount point is required");
  }
}

class InvalidMountPathError {
  /**
   * @constructor
   * @param {string} mountPath
   */
  constructor(mountPath) {
    this.mountPath = mountPath;
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    const regex = /^swap$|^\/$|^(\/[^/\s]+([^/]*[^/\s])*)+$/;
    return !regex.test(this.mountPath);
  }

  /**
   * @method
   * @returns {string}
   */
  render() {
    return _("The mount point is invalid");
  }
}

class MissingSizeError {
  /**
   * @constructor
   * @param {SizeMethod} sizeMethod
   * @param {string|number} size
   */
  constructor (sizeMethod, size) {
    this.sizeMethod = sizeMethod;
    this.size = size;
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    return this.sizeMethod === SIZE_METHODS.MANUAL && !this.size;
  }

  /**
   * @method
   * @returns {string}
   */
  render() {
    return _("A size value is required");
  }
}

class MissingMinSizeError {
  /**
   * @constructor
   * @param {SizeMethod} sizeMethod
   * @param {string|number} minSize
   */
  constructor (sizeMethod, minSize) {
    this.sizeMethod = sizeMethod;
    this.minSize = minSize;
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    return this.sizeMethod === SIZE_METHODS.RANGE && !this.minSize;
  }

  /**
   * @method
   * @returns {string}
   */
  render() {
    return _("Minimum size is required");
  }
}

class InvalidMaxSizeError {
  /**
   * @constructor
   * @param {SizeMethod} sizeMethod
   * @param {string|number} minSize
   * @param {string|number} maxSize
   */
  constructor (sizeMethod, minSize, maxSize) {
    this.sizeMethod = sizeMethod;
    this.minSize = minSize;
    this.maxSize = maxSize;
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    return this.sizeMethod === SIZE_METHODS.RANGE &&
      this.maxSize !== -1 &&
      this.maxSize <= this.minSize;
  }

  /**
   * @method
   * @returns {string}
   */
  render() {
    return _("Maximum must be greater than minimum");
  }
}

class ExistingVolumeError {
  /**
   * @constructor
   * @param {string} mountPath
   * @param {Volume[]} volumes
   */
  constructor(mountPath, volumes) {
    this.mountPath = mountPath;
    this.volumes = volumes;
  }

  /**
   * @method
   * @returns {Volume|undefined}
   */
  findVolume() {
    return this.volumes.find(t => t.mountPath === this.mountPath);
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    return this.mountPath.length && this.findVolume() !== undefined;
  }

  /**
   * @method
   * @param {(volume: Volume) => void} onClick
   * @returns {React.ReactElement}
   */
  render(onClick) {
    const volume = this.findVolume();
    const path = this.mountPath === "/" ? "root" : this.mountPath;

    return (
      <div className="split">
        <span>{sprintf(_("There is already a file system for %s."), path)}</span>
        <Button variant="link" isInline onClick={() => onClick(volume)}>
          {_("Do you want to edit it?")}
        </Button>
      </div>
    );
  }
}

class ExistingTemplateError {
  /**
   * @constructor
   * @param {string} mountPath
   * @param {Volume[]} templates
   */
  constructor(mountPath, templates) {
    this.mountPath = mountPath;
    this.templates = templates;
  }

  /**
   * @method
   * @returns {Volume|undefined}
   */
  findTemplate() {
    return this.templates.find(t => t.mountPath === this.mountPath);
  }

  /**
   * @method
   * @returns {boolean}
   */
  check() {
    return this.mountPath.length && this.findTemplate() !== undefined;
  }

  /**
   * @method
   * @param {(template: Volume) => void} onClick
   * @returns {React.ReactElement}
   */
  render(onClick) {
    const template = this.findTemplate();
    const path = this.mountPath === "/" ? "root" : this.mountPath;

    return (
      <div className="split">
        <span>{sprintf(_("There is a predefined file system for %s."), path)}</span>
        <Button variant="link" isInline onClick={() => onClick(template)}>
          {_("Do you want to add it?")}
        </Button>
      </div>
    );
  }
}

/**
 * Error if the mount path is missing.
 * @function
 *
 * @param {string} mountPath
 * @returns {string|null}
 */
const missingMountPathError = (mountPath) => {
  const error = new MissingMountPathError(mountPath);
  return error.check() ? error.render() : null;
};

/**
 * Error if the mount path is not valid.
 * @function
 *
 * @param {string} mountPath
 * @returns {string|null}
 */
const invalidMountPathError = (mountPath) => {
  const error = new InvalidMountPathError(mountPath);
  return error.check() ? error.render() : null;
};

/**
 * Error if the size is missing.
 * @function
 *
 * @param {SizeMethod} sizeMethod
 * @param {string|number} size
 * @returns {string|null}
 */
const missingSizeError = (sizeMethod, size) => {
  const error = new MissingSizeError(sizeMethod, size);
  return error.check() ? error.render() : null;
};

/**
 * Error if the min size is missing.
 * @function
 *
 * @param {SizeMethod} sizeMethod
 * @param {string|number} minSize
 * @returns {string|null}
 */
const missingMinSizeError = (sizeMethod, minSize) => {
  const error = new MissingMinSizeError(sizeMethod, minSize);
  return error.check() ? error.render() : null;
};

/**
 * Error if the max size is not valid.
 * @function
 *
 * @param {SizeMethod} sizeMethod
 * @param {string|number} minSize
 * @param {string|number} maxSize
 * @returns {string|null}
 */
const invalidMaxSizeError = (sizeMethod, minSize, maxSize) => {
  const error = new InvalidMaxSizeError(sizeMethod, minSize, maxSize);
  return error.check() ? error.render() : null;
};

/**
 * Error if the given mount path exists in the list of volumes.
 * @function
 *
 * @param {string} mountPath
 * @param {Volume[]} volumes
 * @param {(volume: Volume) => void} onClick
 * @returns {React.ReactElement|null}
 */
const existingVolumeError = (mountPath, volumes, onClick) => {
  const error = new ExistingVolumeError(mountPath, volumes);
  return error.check() ? error.render(onClick) : null;
};

/**
 * Error if the given mount path exists in the list of templates.
 * @function
 *
 * @param {string} mountPath
 * @param {Volume[]} templates
 * @param {(template: Volume) => void} onClick
 * @returns {React.ReactElement|null}
 */
const existingTemplateError = (mountPath, templates, onClick) => {
  const error = new ExistingTemplateError(mountPath, templates);
  return error.check() ? error.render(onClick) : null;
};

/**
 * Checks whether there is any error.
 * @function
 *
 * @param {VolumeFormErrors} errors
 * @returns {boolean}
 */
const anyError = (errors) => {
  return compact(Object.values(errors)).length > 0;
};

/**
 * Remove leftover trailing slash.
 * @function
 *
 * @param {string} mountPath
 * @returns {string}
 */
const sanitizeMountPath = (mountPath) => {
  if (mountPath === "/") return mountPath;

  return mountPath.replace(/\/$/, "");
};

/**
 * Creates a new storage volume object based on given params.
 * @function
 *
 * @param {Volume} volume
 * @param {VolumeFormData} formData
 * @returns {Volume}
 */
const createUpdatedVolume = (volume, formData) => {
  let sizeAttrs = {};
  const size = parseToBytes(`${formData.size} ${formData.sizeUnit}`);
  const minSize = parseToBytes(`${formData.minSize} ${formData.minSizeUnit}`);
  const maxSize = parseToBytes(`${formData.maxSize} ${formData.maxSizeUnit}`);

  switch (formData.sizeMethod) {
    case SIZE_METHODS.AUTO:
      sizeAttrs = { minSize: undefined, maxSize: undefined, autoSize: true };
      break;
    case SIZE_METHODS.MANUAL:
      sizeAttrs = { minSize: size, maxSize: size, autoSize: false };
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
 * @function
 *
 * @param {Volume} volume - a storage volume
 * @return {SizeMethod} corresponding size method
 */
const sizeMethodFor = (volume) => {
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
 * @function
 *
 * @param {Volume} volume - a storage volume object
 * @return {VolumeFormData} an object ready to be used as a "form state"
 */
const prepareFormData = (volume) => {
  const { size: minSize = "", unit: minSizeUnit = DEFAULT_SIZE_UNIT } = splitSize(volume.minSize);
  const { size: maxSize = "", unit: maxSizeUnit = minSizeUnit || DEFAULT_SIZE_UNIT } = splitSize(volume.maxSize);

  return {
    size: minSize,
    sizeUnit: minSizeUnit,
    minSize,
    minSizeUnit,
    maxSize,
    maxSizeUnit,
    sizeMethod: sizeMethodFor(volume),
    mountPath: volume.mountPath,
    fsType: volume.fsType,
    snapshots: volume.snapshots
  };
};

/**
 * Possible errors from the form data.
 * @function
 *
 * @returns {VolumeFormErrors}
 */
const prepareErrors = () => {
  return {
    missingMountPath: null,
    invalidMountPath: null,
    existingVolume: null,
    existingTemplate: null,
    missingSize: null,
    missingMinSize: null,
    invalidMaxSize: null
  };
};

/**
 * Initializer function for the React#useReducer used in the {@link VolumesForm}
 * @function
 *
 * @param {Volume} volume - a storage volume object
 * @returns {VolumeFormState}
 */
const createInitialState = (volume) => {
  const formData = prepareFormData(volume);
  const errors = prepareErrors();

  return { volume, formData, errors };
};

/**
 * The VolumeForm reducer.
 * @function
 *
 * @param {VolumeFormState} state
 * @param {object} action
 */
const reducer = (state, action) => {
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
          ...payload
        }
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

/**
 * Renders a dialog that allows the user to add or edit a file system.
 * @component
 *
 * @param {VolumeDialogProps} props
 */
export default function VolumeDialog({
  volume: currentVolume,
  volumes,
  templates,
  isOpen,
  onCancel,
  onAccept
}) {
  /** @type {[VolumeFormState, (action: object) => void]} */
  const [state, dispatch] = useReducer(reducer, currentVolume, createInitialState);

  /** @type {Function} */
  const delayed = useDebounce(f => f(), 1000);

  /** @type {(volume: Volume) => void} */
  const changeVolume = (volume) => {
    dispatch({ type: "CHANGE_VOLUME", payload: { volume } });
  };

  /** @type {(data: object) => void} */
  const updateData = (data) => dispatch({ type: "UPDATE_DATA", payload: data });

  /** @type {(errors: object) => void} */
  const updateErrors = (errors) => dispatch({ type: "SET_ERRORS", payload: errors });

  /** @type {() => string|React.ReactElement} */
  const mountPathError = () => {
    const { missingMountPath, invalidMountPath, existingVolume, existingTemplate } = state.errors;
    return missingMountPath || invalidMountPath || existingVolume || existingTemplate;
  };

  /** @type {() => object} */
  const sizeErrors = () => {
    return {
      size: state.errors.missingSize,
      minSize: state.errors.missingMinSize,
      maxSize: state.errors.invalidMaxSize
    };
  };

  /** @type {() => boolean} */
  const disableWidgets = () => {
    const { existingVolume, existingTemplate } = state.errors;
    return existingVolume !== null || existingTemplate !== null;
  };

  /** @type {() => boolean} */
  const isMountPathEditable = () => {
    const isNewVolume = !volumes.includes(state.volume);
    const isPredefined = state.volume.outline.productDefined;
    return isNewVolume && !isPredefined;
  };

  /** @type {(mountPath: string) => void} */
  const changeMountPath = (mountPath) => {
    // Reset current errors.
    const errors = {
      missingMountPath: null,
      invalidMountPath: null,
      existingVolume: null,
      existingTemplate: null
    };
    updateErrors(errors);

    delayed(() => {
      // Reevaluate in a delayed way.
      const errors = {
        existingVolume: existingVolumeError(mountPath, volumes, changeVolume),
        existingTemplate: existingTemplateError(mountPath, templates, changeVolume)
      };
      updateErrors(errors);
    });

    updateData({ mountPath });
  };

  /** @type {(data: object) => void} */
  const changeSizeOptions = (data) => {
    // Reset errors.
    const errors = {
      missingSize: null,
      missingMinSize: null,
      invalidMaxSize: null
    };
    updateErrors(errors);
    updateData(data);
  };

  /** @type {(e: import("react").FormEvent) => void} */
  const submitForm = (e) => {
    e.preventDefault();
    const { volume: originalVolume, formData } = state;
    const volume = createUpdatedVolume(originalVolume, formData);

    const checkMountPath = isMountPathEditable();

    const errors = {
      missingMountPath: checkMountPath ? missingMountPathError(volume.mountPath) : null,
      invalidMountPath: checkMountPath ? invalidMountPathError(volume.mountPath) : null,
      existingVolume: checkMountPath ? existingVolumeError(volume.mountPath, volumes, changeVolume) : null,
      existingTemplate: checkMountPath ? existingTemplateError(volume.mountPath, templates, changeVolume) : null,
      missingSize: missingSizeError(formData.sizeMethod, volume.minSize),
      missingMinSize: missingMinSizeError(formData.sizeMethod, volume.minSize),
      invalidMaxSize: invalidMaxSizeError(formData.sizeMethod, volume.minSize, volume.maxSize)
    };

    anyError(errors) ? updateErrors(errors) : onAccept(volume);
  };

  const title = renderTitle(state.volume, volumes);
  const { fsType, mountPath } = state.formData;
  const isDisabled = disableWidgets();

  return (
    /** @fixme blockSize medium is too big and small is too small. */
    <Popup title={title} isOpen={isOpen} blockSize="medium" inlineSize="medium">
      <Form id="volume-form" onSubmit={submitForm}>
        <MountPathField
          value={mountPath}
          isReadOnly={!isMountPathEditable()}
          onChange={changeMountPath}
          error={mountPathError()}
        />
        <FsField
          value={fsType}
          volume={state.volume}
          isDisabled={isDisabled}
          onChange={updateData}
        />
        <SizeOptionsField
          { ...state }
          errors={sizeErrors()}
          isDisabled={isDisabled}
          onChange={changeSizeOptions}
        />
      </Form>
      <Popup.Actions>
        <Popup.Confirm
          form="volume-form"
          type="submit"
          isDisabled={isDisabled}
        >
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
