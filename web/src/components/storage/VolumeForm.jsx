/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useReducer } from "react";

import {
  InputGroup, InputGroupItem,
  Form, FormGroup, FormSelect, FormSelectOption,
  Radio,
  TextInput,
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _, N_ } from "~/i18n";
import { FormValidationError, If, NumericTextInput } from '~/components/core';
import { DEFAULT_SIZE_UNIT, SIZE_METHODS, SIZE_UNITS, parseToBytes, splitSize } from '~/components/storage/utils';

/**
 * Callback function for notifying a form input change
 *
 * @callback onChangeFn
 * @param {object} an object with the changed input and its new value
 * @return {void}
 */

/**
 * Form control for selecting a size unit
 * @component
 *
 * Based on {@link PF/FormSelect https://www.patternfly.org/v4/components/form-select}
 *
 * @param {object} props
 * @param {Array<String>} props.units - a collection of size units
 * @param {object} props.formSelectProps - @see {@link https://www.patternfly.org/v4/components/form-select#props}
 * @returns {ReactComponent}
 */
const SizeUnitFormSelect = ({ units, ...formSelectProps }) => {
  return (
    <FormSelect { ...formSelectProps }>
      {/* the unit values are marked for translation in the utils.js file */}
      { units.map(unit => <FormSelectOption key={unit} value={unit} label={_(unit)} />) }
    </FormSelect>
  );
};

/**
 * Form control for selecting a mount point
 * @component
 *
 * Based on {@link PF/FormSelect https://www.patternfly.org/v4/components/form-select}
 *
 * @param {object} props
 * @param {Array<import(~/clients/storage).Volume>} props.volumes - a collection of storage volumes
 * @param {object} props.formSelectProps - @see {@link https://www.patternfly.org/v4/components/form-select#props}
 * @returns {ReactComponent}
 */
const MountPointFormSelect = ({ volumes, ...formSelectProps }) => {
  return (
    <FormSelect { ...formSelectProps }>
      { volumes.map(v => <FormSelectOption key={v.mountPath} value={v.mountPath} label={v.mountPath} />) }
    </FormSelect>
  );
};

/**
 * Widget for rendering the size option content when SIZE_UNITS.AUTO is selected
 * @component
 *
 * @param {object} props
 * @param {import(~/clients/storage).Volume} volume - a storage volume object
 * @returns {ReactComponent}
 */
const SizeAuto = ({ volume }) => {
  const conditions = [];

  if (volume.outline.snapshotsAffectSizes)
    // TRANSLATORS: item which affects the final computed partition size
    conditions.push(_("the configuration of snapshots"));

  if (volume.outline.sizeRelevantVolumes && volume.outline.sizeRelevantVolumes.length > 0)
    // TRANSLATORS: item which affects the final computed partition size
    // %s is replaced by a list of mount points like "/home, /boot"
    conditions.push(sprintf(_("the presence of the file system for %s"),
      // TRANSLATORS: conjunction for merging two list items
                            volume.outline.sizeRelevantVolumes.join(_(", "))));

  // TRANSLATORS: the %s is replaced by the items which affect the computed size
  const conditionsText = sprintf(_("The final size depends on %s."),
    // TRANSLATORS: conjunction for merging two texts
                                 conditions.join(_(" and ")));

  return (
    <>
      {/* TRANSLATORS: the partition size is automatically computed */}
      <p>{_("Automatically calculated size according to the selected product.")}{" "}{conditionsText}</p>
    </>
  );
};

/**
 * Widget for rendering the size option content when SIZE_UNITS.MANUAL is selected
 * @component
 *
 * @param {object} props
 * @param {object} props.errors - the form errors
 * @param {object} props.formData - the form data
 * @param {onChangeFn} props.onChange - callback for notifying input changes
 *
 * @returns {ReactComponent}
 */
const SizeManual = ({ errors, formData, onChange }) => {
  return (
    <div className="stack">
      <p>
        {_("Exact size for the file system.")}
      </p>
      <FormGroup
        fieldId="size"
        isRequired
      >
        <InputGroup className="size-input-group">
          <InputGroupItem>
            <NumericTextInput
              id="size"
              name="size"
              // TRANSLATORS: requested partition size
              aria-label={_("Exact size")}
              // TODO: support also localization for numbers, e.g. decimal comma,
              // either use toLocaleString()
              //   (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString)
              // or use the "globalize" JS library which can also parse the localized string back
              //   (https://github.com/globalizejs/globalize#number-module)
              value={formData.size}
              onChange={(size) => onChange({ size })}
              validated={errors.size && 'error'}
            />
          </InputGroupItem>
          <InputGroupItem>
            <SizeUnitFormSelect
              id="sizeUnit"
              // TRANSLATORS: units selector (like KiB, MiB, GiB...)
              aria-label={_("Size unit")}
              units={Object.values(SIZE_UNITS)}
              value={formData.sizeUnit }
              onChange={(_, sizeUnit) => onChange({ sizeUnit })}
            />
          </InputGroupItem>
        </InputGroup>
        <FormValidationError message={errors.size} />
      </FormGroup>
    </div>
  );
};

/**
 * Widget for rendering the size option content when SIZE_UNITS.RANGE is selected
 * @component
 *
 * @param {object} props
 * @param {object} props.errors - the form errors
 * @param {object} props.formData - the form data
 * @param {onChangeFn} props.onChange - callback for notifying input changes
 *
 * @returns {ReactComponent}
 */
const SizeRange = ({ errors, formData, onChange }) => {
  return (
    <div className="stack">
      <p>
        {_("Limits for the file system size. The final size will be a value between the given minimum \
and maximum. If no maximum is given then the file system will be as big as possible.")}
      </p>
      <div className="split" data-items-alignment="start">
        <FormGroup
          isRequired
          // TRANSLATORS: the minimal partition size
          label={_("Minimum")}
          fieldId="minSize"
          className="size-input-group"
        >
          <InputGroup>
            <InputGroupItem>
              <NumericTextInput
                id="minSize"
                name="minSize"
                // TRANSLATORS: the minium partition size
                aria-label={_("Minimum desired size")}
                value={formData.minSize}
                onChange={(minSize) => onChange({ minSize })}
                validated={errors.minSize && 'error'}
              />
            </InputGroupItem>
            <InputGroupItem>
              <SizeUnitFormSelect
                id="minSizeUnit"
                aria-label={_("Unit for the minimum size")}
                units={Object.values(SIZE_UNITS)}
                value={formData.minSizeUnit }
                onChange={(_, minSizeUnit) => onChange({ minSizeUnit })}
              />
            </InputGroupItem>
          </InputGroup>
          <FormValidationError message={errors.minSize} />
        </FormGroup>
        <FormGroup
          // TRANSLATORS: the maximum partition size
          label={_("Maximum")}
          fieldId="maxSize"
          className="size-input-group"
        >
          <InputGroup>
            <InputGroupItem>
              <NumericTextInput
                id="maxSize"
                name="maxSize"
                validated={errors.maxSize && 'error'}
                // TRANSLATORS: the maximum partition size
                aria-label={_("Maximum desired size")}
                value={formData.maxSize}
                onChange={(maxSize) => onChange({ maxSize })}
              />
            </InputGroupItem>
            <InputGroupItem>
              <SizeUnitFormSelect
                id="maxSizeUnit"
                aria-label={_("Unit for the maximum size")}
                units={Object.values(SIZE_UNITS)}
                value={formData.maxSizeUnit || formData.minSizeUnit }
                onChange={(_, maxSizeUnit) => onChange({ maxSizeUnit })}
              />
            </InputGroupItem>
          </InputGroup>
          <FormValidationError message={errors.maxSize} />
        </FormGroup>
      </div>
    </div>
  );
};

// constants need to be marked for translation with N_() and translated with _() later
const SIZE_OPTION_LABELS = Object.freeze({
  // TRANSLATORS: radio button label, fully automatically computed partition size, no user input
  auto: N_("Auto"),
  // TRANSLATORS: radio button label, exact partition size requested by user
  fixed: N_("Fixed"),
  // TRANSLATORS: radio button label, automatically computed partition size within the user provided min and max limits
  range: N_("Range")
});

/**
 * Widget for rendering the volume size options
 * @component
 *
 * @param {object} props
 * @param {object} props.errors - the form errors
 * @param {object} props.formData - the form data
 * @param {import(~/clients/storage).Volume} volume - the selected storage volume
 * @param {onChangeFn} props.onChange - callback for notifying input changes
 *
 * @returns {ReactComponent}
 */
const SizeOptions = ({ errors, formData, volume, onChange }) => {
  const { sizeMethod } = formData;
  const sizeWidgetProps = { errors, formData, volume, onChange };

  const sizeOptions = [SIZE_METHODS.MANUAL, SIZE_METHODS.RANGE];

  if (volume.outline.supportAutoSize) sizeOptions.push(SIZE_METHODS.AUTO);

  return (
    <div>
      <div className="split radio-group">
        { sizeOptions.map((value) => {
          const isSelected = sizeMethod === value;

          return (
            <Radio
              id={value}
              key={`size-${value}`}
              label={_(SIZE_OPTION_LABELS[value] || value)}
              value={value}
              name="size-option"
              className={isSelected && "selected"}
              isChecked={isSelected}
              onChange={() => onChange({ sizeMethod: value })}
            />
          );
        })}
      </div>

      <div aria-live="polite" className="highlighted-live-region">
        <If condition={sizeMethod === SIZE_METHODS.AUTO} then={<SizeAuto { ...sizeWidgetProps } />} />
        <If condition={sizeMethod === SIZE_METHODS.RANGE} then={<SizeRange {...sizeWidgetProps } />} />
        <If condition={sizeMethod === SIZE_METHODS.MANUAL} then={<SizeManual { ...sizeWidgetProps } />} />
      </div>
    </div>
  );
};

/**
 * Creates a new storage volume object based on given params
 *
 * @param {import(~/clients/storage).Volume} volume - a storage volume
 * @param {object} formData - data used to calculate the volume updates
 * @returns {object} storage volume object
 */
const createUpdatedVolume = (volume, formData) => {
  let updatedAttrs = {};
  const size = parseToBytes(`${formData.size} ${formData.sizeUnit}`);
  const minSize = parseToBytes(`${formData.minSize} ${formData.minSizeUnit}`);
  const maxSize = parseToBytes(`${formData.maxSize} ${formData.maxSizeUnit}`);

  switch (formData.sizeMethod) {
    case SIZE_METHODS.AUTO:
      updatedAttrs = { minSize: undefined, maxSize: undefined, autoSize: true };
      break;
    case SIZE_METHODS.MANUAL:
      updatedAttrs = { minSize: size, maxSize: size, autoSize: false };
      break;
    case SIZE_METHODS.RANGE:
      updatedAttrs = { minSize, maxSize: formData.maxSize ? maxSize : undefined, autoSize: false };
      break;
  }

  return { ...volume, ...updatedAttrs };
};

/**
 * Form-related helper for guessing the size method for given volume
 *
 * @param {import(~/clients/storage).Volume} volume - a storage volume
 * @return {string} corresponding size method
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
 *
 * @param {import(~/clients/storage).Volume} volume - a storage volume object
 * @return {object} an object ready to be used as a "form state"
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
    mountPoint: volume.mountPath
  };
};

/**
 * Initializer function for the React#useReducer used in the {@link VolumesForm}
 *
 * @param {import(~/clients/storage).Volume} volume - a storage volume object
 * @returns {object} a ready to use initial state
 */
const createInitialState = (volume) => {
  return {
    volume,
    formData: prepareFormData(volume),
    errors: {}
  };
};

/**
 * The VolumeForm reducer
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
      return { ...state, errors: payload };
    }

    default: {
      return state;
    }
  }
};

/**
 * Form used for adding a new file system from a list of templates
 * @component
 *
 * @note VolumeForm does not provide a submit button. It is the consumer's
 * responsibility to provide both: the button for triggering the submission by
 * using the form id and the callback function used to perform the submission
 * once the form has been validated.
 *
 * @param {object} props
 * @param {string} props.id - Form ID
 * @param {Array<import(~/clients/storage).Volume>} props.volumes - a collection of storage volumes
 * @param {onSubmitFn} props.onSubmit - Function to use for submitting a new volume
 *
 * @callback onSubmitFn
 * @param {import(~/clients/storage).Volume} volume - a storage volume object
 * @return {void}
 */
export default function VolumeForm({ id, volume: currentVolume, templates = [], onSubmit }) {
  const [state, dispatch] = useReducer(reducer, currentVolume || templates[0], createInitialState);

  const changeVolume = (_, mountPath) => {
    const volume = templates.find(t => t.mountPath === mountPath);
    dispatch({ type: "CHANGE_VOLUME", payload: { volume } });
  };

  const updateData = (data) => dispatch({ type: "UPDATE_DATA", payload: data });

  const validateVolumeSize = (sizeMethod, volume) => {
    const errors = {};
    const { minSize, maxSize } = volume;

    switch (sizeMethod) {
      case SIZE_METHODS.AUTO:
        break;
      case SIZE_METHODS.MANUAL:
        if (!minSize) {
          errors.size = _("A size value is required");
        }
        break;
      case SIZE_METHODS.RANGE:
        if (!minSize) {
          errors.minSize = _("Minimum size is required");
        }

        if (maxSize !== -1 && maxSize <= minSize) {
          errors.maxSize = _("Maximum must be greater than minimum");
        }
        break;
    }

    return errors;
  };

  const submitForm = (e) => {
    e.preventDefault();
    const { volume: originalVolume, formData } = state;
    const volume = createUpdatedVolume(originalVolume, formData);
    const errors = validateVolumeSize(formData.sizeMethod, volume);

    dispatch({ type: "SET_ERRORS", payload: errors });

    if (!Object.keys(errors).length) onSubmit(volume);
  };

  return (
    <Form id={id} onSubmit={submitForm}>
      <FormGroup isRequired label={_("Mount point")} fieldId="mountPoint">
        <MountPointFormSelect
          id="mountPoint"
          value={state.formData.mountPoint}
          onChange={changeVolume}
          volumes={currentVolume ? [currentVolume] : templates}
          isDisabled={currentVolume !== undefined}
        />
      </FormGroup>
      <FormGroup isRequired label={_("File system type")} fieldId="fsType">
        <TextInput
          id="fsType"
          name="fsType"
          value={state.volume.fsType}
          isDisabled
        />
      </FormGroup>
      <FormGroup fieldId="size" label={_("Size")} isRequired>
        <SizeOptions { ...state } onChange={updateData} />
      </FormGroup>
    </Form>
  );
}
