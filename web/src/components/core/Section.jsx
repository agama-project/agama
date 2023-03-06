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

// @ts-check

import React from "react";
import { Link } from "react-router-dom";
import { Text, TextVariants } from "@patternfly/react-core";
import { Icon } from '~/components/layout';
import { ValidationErrors } from "~/components/core";

/**
 * Internal component for rendering the section icon
 *
 * @param {object} props
 * @param {string} [props.name] - the name of the icon
 * @param {number} [props.size=32] - the icon size
 *
 * @return {React.ReactElement}
 */
const SectionIcon = ({ name, size = 32 }) => {
  if (!name) return null;

  return <Icon name={name} size={size} aria-hidden />;
};

/**
 * Internal component for rendering the section title
 *
 *  NOTE: a section can do either, navigate to a page following given path or
 *  open a dialog triggering the openDialog callback but not both. Thus, if path
 *  is given onDialogCallback will be completely ignored. page or open a dialog,
 *  but not both.
 *
 * @param {object} props
 * @param {string} props.text - the title for the section
 * @param {string} props.path - the path where the section links to. If present, props.openDialog is ignored
 * @param {React.MouseEventHandler|undefined} [props.openDialog] - callback to be triggered when user clicks on the title, used for opening a dialog.
 *
 * @return {JSX.Element}
 */
const SectionTitle = ({ text, path, openDialog }) => {
  let title = <>{text}</>;

  if (path && path !== "") {
    title = <Link to={path}>{text}</Link>;
  } else if (typeof openDialog === "function") {
    // NOTE: using a native button here on purpose
    title = <button onClick={openDialog}>{text}</button>;
  }

  return (
    <Text component={TextVariants.h2}>
      {title}
    </Text>
  );
};

/**
 * Internal component for wrapping and rendering the section content
 *
 * @param {object} props
 * @param {React.ReactElement|React.ReactElement[]} props.children - the content to be wrapped
 * @return {JSX.Element}
 */
const SectionContent = ({ children }) => {
  return (
    <div className="stack content">
      {children}
    </div>
  );
};

/**
 *
 * Displays an installation section
 * @component
 *
 *  NOTE: a section can do either, navigate to a page following given path or
 *  open a dialog triggering the openDialog callback but not both. Thus, if path
 *  is given onDialogCallback will be completely ignored. page or open a dialog,
 *  but not both.
 *
 * @example <caption>Simple usage</caption>
 *   <Section title="Users" icon="manage_accounts">
 *     <UsersSummary />
 *   </Section>
 *
 * @example <caption>A section that allows navigating to a page</caption>
 *   <Section title="Users" icon="manage_accounts" path="/users">
 *     <UsersSummary />
 *   </Section>
 *
 * @example <caption>A section that allows opening a settings dialog</caption>
 *   <Section
 *     title="L10n"
 *     icon="translate"
 *     openDialog={() => setLanguageSettingsOpen(true)}
 *   >
 *     <L10nSummary />
 *     <L10nSettings />
 *   </Section>
 *
 * @param {object} props
 * @param {string} [props.icon] - the name of the icon section, if any
 * @param {string} props.title - The title for the section
 * @param {string} props.path - The path where the section links to. If present, props.openDialog is ignored
 * @param {React.MouseEventHandler|undefined} [props.openDialog] - callback to be triggered
 *  when user clicks on the title, used for opening a dialog.
 * @param {boolean} [props.loading] - whether the section is busy loading its content or not
 * @param {import("~/client/mixins").ValidationError[]} [props.errors] - Validation errors to be shown before the title
 * @param {React.ReactElement} props.children - the section content
 */
export default function Section({
  icon,
  title,
  path,
  openDialog,
  loading,
  errors,
  children,
}) {
  return (
    <section>
      <SectionIcon name={loading ? "loading" : icon} />
      <SectionTitle text={title} path={path} openDialog={openDialog} />
      <SectionContent>
        {errors?.length > 0 &&
          <ValidationErrors errors={errors} title={`${title} errors`} />}
        {children}
      </SectionContent>
    </section>
  );
}
