/*
 * Copyright (c) [2022] SUSE LLC
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
import {
  Button,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Text,
  TextContent,
  TextVariants,
  Tooltip
} from "@patternfly/react-core";

import { classNames } from "@/utils";
import { ValidationErrors } from "@components/core";

import { CogIcon } from '@patternfly/react-icons';

import "./section.scss";

/**
 * Helper method for rendering section react-icons
 *
 * @param {React.FunctionComponent|React.ComponentClass} icon
 * @param {string} ariaLabel
 * @param {number} [size=32]
 *
 * @return {React.ReactNode}
 */
const renderIcon = (icon, ariaLabel, size = 32) => {
  if (!icon) return null;

  const Icon = icon;

  return (
    <figure aria-label={ariaLabel}>
      <Icon size={size} />
    </figure>
  );
};

/**
 *
 * Displays an installation section
 * @component
 *
 * @example <caption>Simple usage</caption>
 *   <Section title="Users" icon={UsersIcon}>
 *     <UserSectionContent />
 *   </Section>
 *
 * @example <caption>A section with a description</caption>
 *   <Section title="Users" icon={UsersIcon} description="Use this section for setting the user data">
 *     <UserSectionContent />
 *   </Section>
 *
 * @example <caption>A section without icon but settings action with tooltip</caption>
 *   <Section
 *     key="language"
 *     title="Language"
 *     actionTooltip="Click here for tweaking language settings"
 *     onActionClick={() => setLanguageSettingsVisible(true)}
 *   >
 *     <LanguageSelector />
 *   </Section>
 *
 * @example <caption>A section with title separator and custom action icon</caption>
 *   <Section
 *     title="Target"
 *     icon={TargetIcon}
 *     actionIcon={TargetSettingIcon}
 *     onActionClick={() => setDisplayTargetSettings(true)}
 *     usingSeparator
 *   >
 *     <StorageTargetSelector />
 *   </Section>
 *
 * @param {object} props
 * @param {string} props.title - The title for the section
 * @param {string} [props.description] - A tiny description for the section
 * @param {boolean} [props.usingSeparator] - whether or not a thin border should be shown between title and content
 * @param {React.FunctionComponent} [props.icon] - An icon for the section
 * @param {import("@client/mixins").ValidationError[]} [props.errors] - Validation errors to be shown before the title
 * @param {React.FunctionComponent|React.ComponentClass} [props.actionIcon=CogIcon] - An icon to be used for section actions
 * @param {React.ReactNode} [props.actionTooltip] - text to be shown as a tooltip when user hovers action icon, if present
 * @param {React.MouseEventHandler} [props.onActionClick] - callback to be triggered when user clicks on action icon, if present
 * @param {JSX.Element} [props.children] - the section content
 * @param {object} [props.otherProps] PF4/Split props, see {@link https://www.patternfly.org/v4/layouts/split#props}
 */
export default function Section({
  title,
  description,
  usingSeparator,
  icon,
  errors,
  actionIcon = CogIcon,
  actionTooltip,
  onActionClick,
  children,
  ...otherProps
}) {
  const renderAction = () => {
    if (typeof onActionClick !== 'function') return null;

    const Action = () => (
      <Button variant="plain" className="d-installer-section-action" isInline onClick={onActionClick}>
        {renderIcon(actionIcon, `${title} section action icon`)}
      </Button>
    );

    if (!actionTooltip) return <Action />;

    return (
      <Tooltip content={actionTooltip} position="right" distance={10} entryDelay={200} exitDelay={200}>
        <Action />
      </Tooltip>
    );
  };

  const titleClassNames = classNames(
    "d-installer-section-title",
    usingSeparator && "using-separator"
  );

  return (
    <Split className="d-installer-section" hasGutter {...otherProps}>
      <SplitItem className="d-installer-section-icon">
        {renderIcon(icon, `${title} section icon`, 32)}
      </SplitItem>
      <SplitItem isFilled>
        <Stack hasGutter>
          <StackItem>
            <TextContent>
              <Text component={TextVariants.h2} className={titleClassNames}>
                {title} {renderAction()}
              </Text>
            </TextContent>
          </StackItem>
          { description && description !== "" &&
          <StackItem className="d-installer-section-description">
            <TextContent>
              <Text component={TextVariants.small}>
                {description}
              </Text>
            </TextContent>
          </StackItem> }
          { errors &&
          <StackItem>
            <ValidationErrors errors={errors} title={`${title} errors`} />
          </StackItem> }
          <StackItem>{children}</StackItem>
        </Stack>
      </SplitItem>
    </Split>
  );
}
