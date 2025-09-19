/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import {
  Button,
  ButtonProps,
  Card,
  CardBody,
  CardBodyProps,
  CardFooter,
  CardHeader,
  CardHeaderProps,
  CardProps,
  Divider,
  Flex,
  FlexItem,
  PageGroup,
  PageGroupProps,
  PageSection,
  PageSectionProps,
  Split,
  Title,
  TitleProps,
} from "@patternfly/react-core";
import { ProductRegistrationAlert } from "~/components/product";
import Link, { LinkProps } from "~/components/core/Link";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import flexStyles from "@patternfly/react-styles/css/utilities/Flex/flex";
import { useLocation, useNavigate } from "react-router-dom";
import { isEmpty, isObject } from "radashi";
import { SIDE_PATHS } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Props accepted by Page.Section
 */
type SectionProps = {
  /** The section title */
  title?: React.ReactNode;
  /** Actions to display next to the title */
  titleActions?: React.ReactNode;
  /** The value used for accessible label */
  "aria-label"?: string;
  /** Elements to be rendered in the section footer */
  actions?: React.ReactNode;
  /** A React node with a brief description of what the section is for */
  description?: React.ReactNode;
  /** The heading level used for the section title */
  headingLevel?: TitleProps["headingLevel"];
  /** Whether the section should have a divider between header and body */
  hasHeaderDivider?: boolean;
  /** Props to influence PF/Card component wrapping the section */
  pfCardProps?: CardProps;
  /** Props to influence PF/CardHeader component wrapping the section title */
  pfCardHeaderProps?: CardHeaderProps;
  /** Props to influence PF/CardBody component wrapping the section content */
  pfCardBodyProps?: CardBodyProps;
};

type ActionProps = {
  /** Path to navigate to */
  navigateTo?: LinkProps["to"];
} & ButtonProps;

type SubmitActionProps = {
  /** The id of a <form> the submit button is associated with */
  form: string;
} & ButtonProps;

const defaultCardProps: CardProps = {
  isCompact: true,
  isFullHeight: true,
  component: "section",
};

const STICK_TO_TOP = Object.freeze({ default: "top" });
const STICK_TO_BOTTOM = Object.freeze({ default: "bottom" });

// TODO: check if it should have the banner role
const Header = ({ children, ...props }) => {
  return (
    <PageSection component="div" stickyOnBreakpoint={STICK_TO_TOP} {...props}>
      {children}
    </PageSection>
  );
};

/**
 * Creates a page region on top of PF/Card component
 *
 * @example <caption>Simple usage</caption>
 *   <Page.Section>
 *     <EncryptionSummary />
 *   </Page.Section>
 *
 * @example <caption>Complex usage</caption>
 *   <Page.Section
 *     title="Encryption"
 *     description="Whether device should be protected or not"
 *     pfCardBodyProps={{ isFilled: true }}
 *     actions={isEnabled ? <DisableAction /> : <EnableAction />}
 *   >
 *       <EncryptionSummary />
 *     )}
 *   </Page.Section>
 */
const Section = ({
  title,
  titleActions,
  "aria-label": ariaLabel,
  description,
  actions,
  headingLevel = "h3",
  hasHeaderDivider = false,
  pfCardProps,
  pfCardHeaderProps,
  pfCardBodyProps,
  children,
}: React.PropsWithChildren<SectionProps>) => {
  const titleId = useId();
  const hasTitle = !isEmpty(title);
  const hasDescription = !isEmpty(description);
  const hasHeader = hasTitle || hasDescription;
  const hasAriaLabel =
    !isEmpty(ariaLabel) || (isObject(pfCardProps) && "aria-label" in pfCardProps);
  const props = { ...defaultCardProps, "aria-label": ariaLabel };

  if (!hasTitle && !hasAriaLabel) {
    console.error("Page.Section must have either, a title or aria-label");
  }

  if (hasTitle && !hasAriaLabel) props["aria-labelledby"] = titleId;

  return (
    <Card {...props} {...pfCardProps}>
      {hasHeader && (
        <CardHeader {...pfCardHeaderProps}>
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
      <CardBody {...pfCardBodyProps}>{children}</CardBody>
      {actions && (
        <CardFooter>
          <Split hasGutter>{actions}</Split>
        </CardFooter>
      )}
    </Card>
  );
};

/**
 * Wraps given children in an PF/PageGroup sticky at the bottom
 *
 * TODO: check if it contentinfo role really should have the banner role
 *
 * @see [PatternFly Page/PageGroup](https://www.patternfly.org/components/page#pagegroup)
 *
 * @example
 *   <Page.Actions>
 *     <Page.Action onClick={doSomething}>Let's go</Page.Action>
 *   </Page.Actions>
 *
 */
const Actions = ({
  children,
  noDefaultWrapper = false,
}: React.PropsWithChildren<{ noDefaultWrapper?: boolean }>) => {
  const Wrapper = noDefaultWrapper ? React.Fragment : Split;
  const wrapperProps = noDefaultWrapper ? {} : { hasGutter: true };

  return (
    <PageGroup
      role="contentinfo"
      hasShadowTop
      stickyOnBreakpoint={STICK_TO_BOTTOM}
      className={flexStyles.flexGrow_0}
    >
      <PageSection component="div">
        <Wrapper {...wrapperProps}>{children}</Wrapper>
      </PageSection>
    </PageGroup>
  );
};

/**
 * Handy component built on top of PF/Button for rendering a page action
 *
 * @see [PatternFly Button](https://www.patternfly.org/components/button).
 */
const Action = ({ navigateTo, children, ...props }: ActionProps) => {
  const navigate = useNavigate();

  const onClickFn = props.onClick;

  props.onClick = (e) => {
    if (typeof onClickFn === "function") onClickFn(e);
    if (navigateTo) navigate(navigateTo);
  };

  return <Button {...props}>{children}</Button>;
};

/**
 * Handy component for rendering a "Cancel" action
 *
 * NOTE: by default it navigates to the top path, which can be changed
 * `navigateTo` prop BUT not for navigating back into the history. Use Page.Back
 * for the latest, which behaves differently.
 */
const Cancel = ({ navigateTo = "..", children, ...props }: ActionProps) => {
  return (
    <Link to={navigateTo} variant="link" {...props}>
      {children || _("Cancel")}
    </Link>
  );
};

/**
 * Handy component for rendering a "Back" action
 *
 * NOTE: It does not behave like Page.Cancel, since does not support changing
 * the path to navigate to, and always goes one path back in the history (-1)
 *
 * NOTE: Not using Page.Cancel for practical reasons about useNavigate
 * overloading, which kind of forces to write an ugly code for supporting both
 * types, "To" and "number", without a TypeScript complain. To know more, see
 * https://github.com/remix-run/react-router/issues/10505#issuecomment-2237126223
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
 * Handy component to submit a form matching the id given in the `form` prop
 */
const Submit = ({ children, ...props }: SubmitActionProps) => {
  return (
    <Action type="submit" {...props}>
      {children || _("Accept")}
    </Action>
  );
};

/**
 * Wrapper for the section content built on top of PF/Page/PageSection
 *
 * @see [Patternfly Page/PageSection](https://www.patternfly.org/components/page#pagesection)
 */
const Content = ({ children, ...pageSectionProps }: React.PropsWithChildren<PageSectionProps>) => {
  const location = useLocation();
  const mountRegistrationAlert = !SIDE_PATHS.includes(location.pathname);

  return (
    <>
      <PageSection hasBodyWrapper={false} isFilled component="div" {...pageSectionProps}>
        {mountRegistrationAlert && <ProductRegistrationAlert />}
        {children}
      </PageSection>
    </>
  );
};

/**
 * Component for structuring an Agama page, built on top of PF/Page/PageGroup.
 *
 * @see [Patternfly Page/PageGroup](https://www.patternfly.org/components/page#pagegroup)
 *
 * @example
 *   <Page>
 *     <Page.Header>
 *       <h2>{_("Software")}</h2>
 *     </Page.Header>
 *
 *     <Page.Content>
 *       <Stack hasGutter>
 *         <IssuesHint issues={issues} />
 *
 *         <Page.Section title="Selected patterns" >
 *           {patterns.length === 0 ? <NoPatterns /> : <SelectedPatterns patterns={patterns} />}
 *         </Page.Section>
 *
 *         <Page.Section aria-label="Used size">
 *           <UsedSize size={proposal.size} />
 *         </Page.Section>
 *       </Stack>
 *       <Page.Actions>
 *         <Page.Back />
 *       </Page.Actions>
 *     </Page.Content>
 *   </Page>
 */
const Page = ({
  children,
  ...pageGroupProps
}: React.PropsWithChildren<PageGroupProps>): React.ReactNode => {
  return (
    <PageGroup {...pageGroupProps} tabIndex={-1} id="main-content">
      {children}
    </PageGroup>
  );
};

Page.displayName = "agama/core/Page";
Page.Header = Header;
Page.Content = Content;
Page.Actions = Actions;
Page.Back = Back;
Page.Cancel = Cancel;
Page.Submit = Submit;
Page.Action = Action;
Page.Section = Section;

export default Page;
