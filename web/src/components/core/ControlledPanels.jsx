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

import React from "react";

/**
 * Wrapper component for holding ControlledPanel options
 *
 * Useful for rendering the ControlledPanel options horizontally.
 *
 * @see ControlledPanel examples.
 *
 * @param {React.PropsWithChildren} props
 */
const Options = ({ children, ...props }) => {
  return (
    <div className="split" {...props}>
      { children }
    </div>
  );
};

/**
 * Renders an option intended to control the visibility of panels referenced by
 * the controls prop.
 *
 * @typedef {object} OptionProps
 * @property {string} id - The option id.
 * @property {React.AriaAttributes["aria-controls"]} controls - A space-separated of one or more ID values
 *   referencing the elements whose contents or presence are controlled by the option.
 * @property {boolean} isSelected - Whether the option is selected or not.
 * @typedef {Omit<React.ComponentPropsWithoutRef<"input">, "aria-controls">} InputProps
 *
 * @param {React.PropsWithChildren<InputProps & OptionProps>} props
 */
const Option = ({ id, controls, isSelected, children, ...props }) => {
  return (
    <div data-type="agama/option">
      <label htmlFor={id}>
        <input id={id} checked={isSelected} type="radio" aria-controls={controls} {...props} />
        {children}
      </label>
    </div>
  );
};

/**
 * Renders content whose visibility will be controlled by an option
 *
 * @typedef {object} PanelBaseProps
 * @property {string} id - The option id.
 * @property {boolean} isExpanded - The value for the aria-expanded attribute
 *   which will determine if the panel is visible or not.
 *
 * @typedef {PanelBaseProps & Omit<React.HTMLAttributes<HTMLDivElement>, "id" | "aria-expanded">} PanelProps
 *
 * @param {PanelProps} props
 */
const Panel = ({ id, isExpanded = false, children, ...props }) => {
  return (
    <div {...props} id={id} aria-expanded={isExpanded}>
      { children }
    </div>
  );
};

/**
 * TODO: Write the documentation and examples.
 * TODO: Find a better name.
 * TODO: Improve it.
 * NOTE: Please, be aware that despite the name, this has no relation with so
 * called React controlled components https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components
 * This is just a convenient, dummy component for simplifying the use of this
 * options/tabs pattern across Agama UI.
 */
const ControlledPanels = ({ children, ...props }) => {
  return (
    <div {...props} data-type="agama/controlled-panels">
      { children }
    </div>
  );
};

ControlledPanels.Options = Options;
ControlledPanels.Option = Option;
ControlledPanels.Panel = Panel;

export default ControlledPanels;
