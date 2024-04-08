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
import { Icon } from "~/components/layout";
import { If } from "~/components/core";

/**
 * @typedef {import("~/components/layout/Icon").IconName} IconName
 * @typedef {import("~/components/layout/Icon").IconSize} IconSize
 */

/**
 * @typedef {object} FieldProps
 * @property {React.ReactNode} label - The field label.
 * @property {React.ReactNode} [value] - The field value.
 * @property {React.ReactNode} [description] - A field description, useful for providing context to the user.
 * @property {IconName} [icon] - The name of the icon for the field.
 * @property {IconSize} [iconSize="s"] - The size for the field icon.
 * @property {string} [className] - ClassName
 * @property {() => {}} [onClick] - Callback
 * @property {React.ReactNode} [children] - A content to be rendered as field children
 *
 * @typedef {Omit<FieldProps, 'icon'>} FieldPropsWithoutIcon
 */

/**
 * Component for laying out a page field
 *
 * @param {FieldProps} props
 */
const Field = ({
  label,
  value,
  description,
  icon,
  iconSize = "s",
  onClick,
  children,
  ...props
}) => {
  return (
    <div {...props} data-type="agama/field">
      <div>
        <button className="plain-control" onClick={onClick}>
          <If condition={icon?.length > 0} then={<Icon name={icon} size={iconSize} />} /> <b>{label}</b>
        </button> {value}
      </div>
      <div>
        {description}
      </div>
      <div>
        { children }
      </div>
    </div>
  );
};

/**
 * @param {Omit<FieldProps, 'icon'>} props
 */
const SettingsField = ({ ...props }) => {
  return <Field {...props} icon="settings" />;
};

/**
 * @param {Omit<FieldProps, 'icon'> & {isChecked: true}} props
 */
const SwitchField = ({ isChecked, ...props }) => {
  const iconName = isChecked ? "toggle_on" : "toggle_off";
  const className = isChecked ? "on" : "off";

  return <Field {...props} icon={iconName} className={className} />;
};

/**
 * @param {Omit<FieldProps, 'icon'> & {isExpanded: boolean}} props
 */
const ExpandableField = ({ isExpanded, ...props }) => {
  const iconName = isExpanded ? "collapse_all" : "expand_all";
  const className = isExpanded ? "expanded" : "collapsed";

  return <Field {...props} icon={iconName} className={className} />;
};

export default Field;
export { ExpandableField, SettingsField, SwitchField };
