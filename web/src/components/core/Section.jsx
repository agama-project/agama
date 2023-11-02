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
 * @param {object} props
 * @param {string} props.id - the id for the header.
 * @param {string} props.text - the title for the section.
 * @param {string} props.path - the path where the section links to.
 *
 * @return {JSX.Element}
 */
const SectionTitle = ({ id, text, path }) => {
  if (!text?.trim()) return null;

  const title = !path?.trim() ? <>{text}</> : <Link to={path}>{text}</Link>;

  return <h2 id={id}>{title}</h2>;
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
 * Renders children into an HTML section
 * @component
 *
 * @example <caption>Simple usage</caption>
 *   <Section title="Users" name="users" icon="manage_accounts">
 *     <UsersSummary />
 *   </Section>
 *
 * @example <caption>A section without title</caption>
 *   <Section aria-label="Users summary">
 *     <UsersSummary />
 *   </Section>
 *
 * @example <caption>A section that allows navigating to a page</caption>
 *   <Section title="Users" name="users" icon="manage_accounts" path="/users">
 *     <UsersSummary />
 *   </Section>
 *
 * @typedef { Object } SectionProps
 * @property {string} [icon] - Name of the section icon. Not rendered if title is not provided.
 * @property {string} [title] - The section title. If not given, aria-label must be provided.
 * @property {string} [name] - The section name. Used to build the header id.
 * @property {string} [path] - Path where the section links to.
 *  when user clicks on the title, used for opening a dialog.
 * @property {boolean} [loading] - Whether the section is busy loading its content or not.
 * @property {import("~/client/mixins").ValidationError[]} [props.errors] - Validation errors to be shown before the title.
 * @property {React.ReactElement} [children] - The section content.
 * @property {string} [aria-label] - aria-label attribute, required if title if not given
 *
 * @param { SectionProps } props
 */
export default function Section({
  icon,
  title,
  name,
  path,
  loading,
  errors,
  children,
  "aria-label": ariaLabel
}) {
  const headerId = `${name || crypto.randomUUID()}-section-header`;

  if (!title && !ariaLabel) {
    console.error("The Section component must have either, a 'title' or an 'aria-label'");
  }

  const SectionHeader = () => {
    if (!title) return;

    return (
      <>
        <SectionIcon name={loading ? "loading" : icon} />
        <SectionTitle id={headerId} text={title} path={path} />
      </>
    );
  };

  return (
    <section
      aria-live="polite"
      aria-busy={loading}
      aria-label={ariaLabel || undefined}
      aria-labelledby={ title && !ariaLabel ? headerId : undefined}
    >
      <SectionHeader />
      <SectionContent>
        {errors?.length > 0 &&
          <ValidationErrors errors={errors} title={`${title} errors`} />}
        {children}
      </SectionContent>
    </section>
  );
}
