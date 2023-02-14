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
  Text,
  TextContent,
  TextVariants,
  Tooltip
} from "@patternfly/react-core";

import { Icon } from '~/components/layout';
import { ValidationErrors } from "~/components/core";

/**
 * Helper method for rendering section icon
 *
 * @param {string} name
 * @param {number} [size=32]
 *
 * @return {React.ReactNode}
 */
const renderIcon = (name, size = 32) => {
  if (!name) return null;

  return <Icon name={name} size={size} aria-hidden />;
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
 * @param {boolean} [props.hasSeparator] - whether or not a thin border should be shown between title and content
 * @param {string} [props.iconName] - the name of the icon section, if any
 * @param {string} [props.actionIconName="settings"] - name for the icon for linking to section settings, when needed
 * @param {React.ReactNode} [props.actionTooltip] - text to be shown as a tooltip when user hovers action icon, if present
 * @param {React.MouseEventHandler} [props.onActionClick] - callback to be triggered when user clicks on action icon, if present
 * @param {import("~/client/mixins").ValidationError[]} [props.errors] - Validation errors to be shown before the title
 * @param {JSX.Element} [props.children] - the section content
 */
export default function Section({
  title,
  description,
  hasSeparator,
  iconName,
  actionIconName = "settings",
  actionTooltip,
  onActionClick,
  errors,
  children,
}) {
  const renderAction = () => {
    if (typeof onActionClick !== 'function') return null;

    const Action = () => (
      <Button
        isInline
        variant="link"
        className="transform-on-hover"
        onClick={onActionClick}
        aria-label="Section settings"
      >
        {renderIcon(actionIconName, 16)}
      </Button>
    );

    if (!actionTooltip) return <Action />;

    return (
      <Tooltip content={actionTooltip} position="right" distance={10} entryDelay={200} exitDelay={200}>
        <Action />
      </Tooltip>
    );
  };

  let headerClassNames = "split";
  if (hasSeparator) headerClassNames += " gradient-border-bottom";

  return (
    <section>
      {renderIcon(iconName, 32)}

      <Text component={TextVariants.h2} className={headerClassNames}>
        {title}
        {renderAction()}
      </Text>

      <div className="stack content">
        { description && description !== "" &&
          <TextContent>
            <Text component={TextVariants.small}>
              {description}
            </Text>
          </TextContent> }
        { errors?.length > 0 &&
          <ValidationErrors errors={errors} title={`${title} errors`} /> }
        {children}
      </div>
    </section>
  );
}
