/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useEffect } from "react";
import { Form, FormGroup, FormSelectOption, Grid, GridItem } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { Page } from "~/components/core";
import { useInstallerL10n } from "~/context/installerL10n";
// import { ROOT as PATHS } from "~/routes/paths";
import { _ } from "~/i18n";
import supportedLanguages from "~/languages.json";
import { Center, Icon } from "../layout";
import { useLocalStorage } from "~/utils";
import { ROOT as PATHS } from "~/routes/paths";

/**
 * A page component to allow setting the installer langauge
 */
function WelcomePage() {
  const { language, changeLanguage } = useInstallerL10n();
  const [showWelcomePage, setShowWelcomePage] = useLocalStorage("agm-show-welcome-page");
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    await changeLanguage(formData.get("language") as string);
    setShowWelcomePage(false);
    // navigate(PATHS.root, { replace: true });
  };

  useEffect(() => {
    !showWelcomePage && navigate(PATHS.root, { replace: true });
  });

  return (
    <Page>
      <Page.Content>
        <Grid>
          <GridItem sm={12} lg={10} lgOffset={1} xl={6} xlOffset={3}>
            <Center>
              <Page.Section
                headerLevel="h2"
                title={_("Welcome!")}
                pfCardProps={{ isCompact: false }}
                description={_("Before continue, please select your preferred language")}
              >
                <Form id="installerOptionsForm" onSubmit={onSubmit}>
                  <FormGroup
                    fieldId="language"
                    label={
                      <>
                        <Icon name="translate" size="s" /> {_("Language")}
                      </>
                    }
                  >
                    <select id="language" name="language" size={20} defaultValue={language}>
                      {Object.keys(supportedLanguages)
                        .sort()
                        .map((id, index) => (
                          <FormSelectOption key={index} label={supportedLanguages[id]} value={id} />
                        ))}
                    </select>
                  </FormGroup>
                </Form>
              </Page.Section>
            </Center>
          </GridItem>
        </Grid>
      </Page.Content>
      <Page.Actions>
        <Page.Submit form="installerOptionsForm" />
      </Page.Actions>
    </Page>
  );
}

export default WelcomePage;
