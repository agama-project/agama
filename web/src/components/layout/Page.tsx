/*
 * Copyright (c) [2023-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import React, { useId } from "react";
import { useNavigate } from "react-router";
import Link, { LinkProps } from "~/components/core/Link";
import {
  Button,
  ButtonProps,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardProps,
  Divider,
  Flex,
  FlexItem,
  PageSection,
  PageSectionProps,
  Split,
  Title,
  TitleProps,
} from "@patternfly/react-core";
import { isEmpty } from "radashi";
import MinimalLayout from "~/components/layout/MinimalLayout";
import StandardLayout from "~/components/layout/StandardLayout";
import { _, TranslatedString } from "~/i18n";

import type { MinimalLayoutProps } from "~/components/layout/MinimalLayout";
import type { StandardLayoutProps } from "~/components/layout/StandardLayout";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

/**
 * Ways of naming a section, which are mutually exclusive.
 *
 * A visible title is always preferable, so an invisible label is never
 * accepted next to it.
 */
type SectionNameProps =
  | {
      /**
       * The section title, rendered as a heading and used as accessible name.
       *
       * Takes a translated string, or an element when the title needs markup,
       * like a quieter font size or a counter next to the name.
       */
      title: TranslatedString | React.ReactElement;
      "aria-label"?: never;
    }
  | {
      title?: never;
      /**
       * Accessible name for a section with no visible title.
       *
       * Last resort: prefer a title, which names the section for everybody.
       */
      "aria-label"?: TranslatedString;
    };

/**
 * Props accepted by Page.Section
 */
type SectionProps = SectionNameProps & {
  /** Actions to display next to the title */
  titleActions?: React.ReactNode;
  /** Elements to be rendered in the section footer */
  actions?: React.ReactNode;
  /**
   * A brief description of what the section is for.
   *
   * Takes a translated string, or an element for anything else: markup, or a
   * value that is data rather than text to translate.
   */
  description?: TranslatedString | React.ReactElement;
  /**
   * The heading level used for the section title.
   *
   * Defaults to the level below the page title, which suits a section placed
   * directly on a page. Pass a deeper level for a section nested under another
   * heading, so the page outline skips no level.
   */
  headingLevel?: TitleProps["headingLevel"];
  /** Whether the section should have a divider between header and body */
  hasHeaderDivider?: boolean;
  /**
   * Whether the section stretches to fill the height available to it, instead
   * of taking only the height its content needs.
   */
  isFullHeight?: boolean;
};

type CancelProps = Omit<LinkProps, "to"> & {
  /** Path to navigate to */
  navigateTo?: LinkProps["to"];
};

type SubmitActionProps = {
  /** The id of a <form> the submit button is associated with */
  form?: string;
} & ButtonProps;

/**
 * Groups related page content in a card, built on top of PF/Card.
 *
 * A named section is a region: it shows up in the landmark list, letting
 * screen reader users jump straight to it. An unnamed one is a plain visual
 * grouping, so how the section is named decides what it becomes:
 *
 * - with a `title`: a region named after the visible heading.
 * - with an `aria-label` and no title: a region named after that label.
 * - with neither: no region, just a card.
 *
 * Sections deliberately expose only part of what a PF/Card can do, through
 * props of their own. When a page needs something outside that part, there
 * are two ways out:
 *
 * 1. add a prop here, as long as it says what changes for a section rather
 *    than for a card, and other pages could plausibly ask for the same. That
 *    keeps the decision in one place, and every page gets it.
 * 2. render a PF/Card on that page instead. This is not a replacement for a
 *    card, it is an opinionated container for the shape pages usually need,
 *    so a page that has to change much of it is better off with its own.
 *
 * @example <caption>A plain grouping, no name needed</caption>
 *   <Page.Section>
 *     <EncryptionSummary />
 *   </Page.Section>
 *
 * @example <caption>A region named "Encryption"</caption>
 *   <Page.Section
 *     title={_("Encryption")}
 *     description={_("Whether the device should be protected or not")}
 *     actions={isEnabled ? <DisableAction /> : <EnableAction />}
 *   >
 *     <EncryptionSummary />
 *   </Page.Section>
 *
 * @example <caption>A title kept at text size, on a page where a heading
 * would look too loud. The level still follows the page outline.</caption>
 *   <Page.Section title={<Text textStyle="fontSizeMd">{_("Controllers")}</Text>}>
 *     <ControllersSummary />
 *   </Page.Section>
 */
const Section = ({
  title,
  titleActions,
  "aria-label": ariaLabel,
  description,
  actions,
  headingLevel = "h2",
  hasHeaderDivider = false,
  isFullHeight = false,
  children,
}: React.PropsWithChildren<SectionProps>) => {
  const titleId = useId();
  const hasTitle = !isEmpty(title);
  const hasDescription = !isEmpty(description);
  const hasHeader = hasTitle || hasDescription;
  const hasAriaLabel = !isEmpty(ariaLabel);

  const props: CardProps = {
    isCompact: true,
    isFullHeight,
    // Only a named section becomes a region, so an unnamed one must not render
    // a section element at all.
    component: hasTitle || hasAriaLabel ? "section" : "div",
    ...(hasTitle && { "aria-labelledby": titleId }),
    ...(hasAriaLabel && { "aria-label": ariaLabel }),
  };

  return (
    <Card {...props}>
      {hasHeader && (
        <CardHeader>
          {hasTitle && (
            <Flex>
              <Title id={titleId} headingLevel={headingLevel}>
                {title}
              </Title>
              {titleActions && (
                <>
                  <FlexItem grow={{ default: "grow" }} />
                  {titleActions}
                </>
              )}
            </Flex>
          )}
          {hasDescription && <div className={textStyles.textColorPlaceholder}>{description}</div>}
        </CardHeader>
      )}
      {hasHeaderDivider && <Divider />}
      <CardBody>{children}</CardBody>
      {actions && (
        <CardFooter>
          <Split hasGutter>{actions}</Split>
        </CardFooter>
      )}
    </Card>
  );
};

/**
 * Link that leaves the current page without applying anything.
 *
 * It is a link because it goes to a known route, the parent one by default:
 * users can see where it leads, open it in a new tab, and bookmark it. Use
 * Page.Back instead to return wherever the user came from.
 *
 * On the way out: pages built on the form stack cancel through the button that
 * comes with the form. This one serves the pages not migrated yet and goes with
 * the last of them.
 */
const Cancel = ({ navigateTo = "..", children, ...props }: CancelProps) => {
  return (
    <Link to={navigateTo} variant="link" keepQuery {...props}>
      {children || _("Cancel")}
    </Link>
  );
};

/**
 * Button that returns to the previous entry in the history.
 *
 * It is a button because the destination depends on how the user got here, so
 * there is no address to show or share. Use Page.Cancel to go to a known route
 * instead.
 *
 * On the way out as well, for a different reason: pages carry breadcrumbs, so
 * the way back up is already there and named, and the browser covers going back
 * one step. Do not add new uses while what replaces it gets decided.
 */
const Back = ({ children, ...props }: Omit<ButtonProps, "onClick">) => {
  const navigate = useNavigate();

  return (
    <Button variant="link" {...props} onClick={() => navigate(-1)}>
      {children || _("Back")}
    </Button>
  );
};

/**
 * Button that submits the form given in the `form` prop.
 *
 * Handy for placing the submit button outside of the form it belongs to.
 *
 * On the way out: pages built on the form stack submit through the button that
 * comes with the form, which also knows whether submitting is possible at all.
 * This one serves the pages not migrated yet and goes with the last of them.
 */
const Submit = ({ children, ...props }: SubmitActionProps) => {
  return (
    <Button type="submit" {...props}>
      {children || _("Accept")}
    </Button>
  );
};

/**
 * Wrapper for the section content built on top of PF/Page/PageSection
 *
 * @see [Patternfly Page/PageSection](https://www.patternfly.org/components/page#pagesection)
 */
const Content = ({ children, ...pageSectionProps }: PageSectionProps) => {
  return (
    <PageSection hasBodyWrapper={false} isFilled component="div" {...pageSectionProps}>
      {children}
    </PageSection>
  );
};

/**
 * Props for the `Page` component, one set per layout variant.
 *
 * Each variant takes what its layout renders, plus the variant itself.
 */
type PageProps =
  | (StandardLayoutProps & {
      /** Layout variant to use */
      variant?: "standard";
    })
  | (MinimalLayoutProps & {
      /** Layout variant - minimal layout with empty masthead (e.g., for login pages) */
      variant: "minimal";
    });

/**
 * Root container for Agama pages.
 *
 * It builds the shell every page shares: the header with its title or
 * breadcrumbs and its tools, the main content area, the questions and the
 * optional progress reporting.
 *
 * It serves two purposes, and works the same either way:
 *
 * - as the container of a single page, which renders its own content.
 * - as the layout of a group of routes, which renders whatever route is
 *   active when it gets no content of its own.
 *
 * @see {@link https://www.patternfly.org/components/page | PatternFly Page}
 *
 * @example <caption>A page with a title and its own content</caption>
 * ```tsx
 * <Page title="Software">
 *   <Page.Content>
 *     <Page.Section title="Patterns">
 *       <PatternSelector />
 *     </Page.Section>
 *   </Page.Content>
 * </Page>
 * ```
 *
 * @example <caption>A page reporting the progress of its own scope</caption>
 * ```tsx
 * <Page
 *   breadcrumbs={[{ label: "Software" }]}
 *   progress={{
 *     scope: "software",
 *     awaitQueriesRefetch: [PROPOSAL_QUERY_KEY, EXTENDED_CONFIG_QUERY_KEY]
 *   }}
 * >
 *   <SoftwareContent />
 * </Page>
 * ```
 *
 * @example <caption>The layout of a group of routes</caption>
 * ```tsx
 * { element: <Page title="Storage" />, children: storageRoutes }
 * ```
 *
 * @example <caption>A page with no header, for login and error pages</caption>
 * ```tsx
 * <Page variant="minimal">
 *   <LoginForm />
 * </Page>
 * ```
 */
const Page = (props: PageProps): React.ReactNode => {
  if (props.variant === "minimal") {
    return <MinimalLayout>{props.children}</MinimalLayout>;
  }

  const { variant, ...standardProps } = props;
  return <StandardLayout {...standardProps} />;
};

Page.displayName = "agama/layout/Page";
Page.Content = Content;
// A @deprecated tag only reaches the pages using one of these members when it
// sits here, next to the member, and not on the component defined above.
/** @deprecated go back through the breadcrumbs, or say where the link leads */
Page.Back = Back;
/** @deprecated cancel through the button that comes with the form stack */
Page.Cancel = Cancel;
/** @deprecated submit through the button that comes with the form stack */
Page.Submit = Submit;
Page.Section = Section;

export default Page;
