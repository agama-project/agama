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

import React, { useReducer, useEffect } from "react";
import { useCancellablePromise } from "@/utils";
import { useInstallerClient } from "@context/installer";

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption
} from "@patternfly/react-core";

import { Popup } from '@components/core';

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      return { ...state, ...action.payload };
    }
    case "ACCEPT": {
      return { ...state, isFormOpen: false, current: state.formCurrent };
    }

    case "CANCEL": {
      return { ...state, isFormOpen: false };
    }

    case "CHANGE": {
      return { ...state, formCurrent: action.payload };
    }

    case "MODIFIED": {
      return { ...state, current: action.payload };
    }

    case "OPEN": {
      return { ...state, isFormOpen: true, formCurrent: state.current };
    }

    default: {
      return state;
    }
  }
};

const initialState = {
  languages: [],
  current: null,
  formCurrent: null,
  isFormOpen: false
};

export default function LanguageSelector() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { current: language, languages, isFormOpen } = state;

  useEffect(() => {
    const loadLanguages = async () => {
      const languages = await cancellablePromise(client.language.getLanguages());
      const [current] = await cancellablePromise(client.language.getSelectedLanguages());
      dispatch({
        type: "LOAD",
        payload: { languages, current }
      });
    };

    loadLanguages().catch(console.error);
  }, [client.language, cancellablePromise]);

  useEffect(() => {
    return client.language.onLanguageChange(language => {
      dispatch({
        type: "MODIFIED",
        payload: language
      });
    });
  }, [client.language]);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => dispatch({ type: "CANCEL" });

  const accept = async (e) => {
    e.preventDefault();
    // TODO: handle errors
    await client.language.setLanguages([state.formCurrent]);
    dispatch({ type: "ACCEPT" });
  };

  const label = () => {
    const selectedLanguage = languages.find(lang => lang.id === language);
    return selectedLanguage ? selectedLanguage.name : "Select language";
  };

  const buildSelector = formCurrent => {
    const selectorOptions = languages.map(lang => (
      <FormSelectOption key={lang.id} value={lang.id} label={lang.name} />
    ));

    return (
      <FormSelect
        id="language"
        aria-label="language"
        value={formCurrent}
        onChange={v => dispatch({ type: "CHANGE", payload: v })}
      >
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={open}>
        {label()}
      </Button>

      <Popup
        isOpen={isFormOpen}
        aria-label="Language Selector"
      >
        <Form id="language-selector" onSubmit={accept}>
          <FormGroup fieldId="language" label="Language">
            {buildSelector(state.formCurrent)}
          </FormGroup>
        </Form>
        <Popup.Actions>
          <Popup.Confirm form="language-selector" type="submit" />
          <Popup.Cancel onClick={cancel} />
        </Popup.Actions>
      </Popup>
    </>
  );
}
