import React, { useReducer, useEffect } from "react";
import { useInstallerClient } from "./context/installer";

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant
} from "@patternfly/react-core";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD": {
      return { ...state, ...action.payload };
    }
    case "ACCEPT": {
      return { ...state, isFormOpen: false };
    }

    case "CANCEL": {
      return { ...state, isFormOpen: false, current: state.initial };
    }

    case "CHANGE": {
      return { ...state, current: action.payload };
    }

    case "OPEN": {
      return { ...state, isFormOpen: true };
    }

    default: {
      return state;
    }
  }
};

const initialState = {
  languages: [],
  initial: null,
  current: null,
  isFormOpen: false
};

export default function LanguageSelector() {
  const client = useInstallerClient();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { current: language, languages, isFormOpen } = state;

  useEffect(async () => {
    const languages = await client.getLanguages();
    const current = await client.getOption("Language");
    dispatch({
      type: "LOAD",
      payload: { languages, current, initial: current }
    });
  }, []);

  const open = () => dispatch({ type: "OPEN" });

  const cancel = () => dispatch({ type: "CANCEL" });

  const accept = async () => {
    // TODO: handle errors
    await client.setOption("Language", language);
    dispatch({ type: "ACCEPT" });
  };

  const label = () => {
    const selectedLanguage = languages.find(lang => lang.id === language);
    return selectedLanguage ? selectedLanguage.name : "Select language";
  };

  const buildSelector = () => {
    const selectorOptions = languages.map(lang => (
      <FormSelectOption key={lang.id} value={lang.id} label={lang.name} />
    ));

    return (
      <FormSelect
        id="language"
        value={language}
        onChange={v => dispatch({ type: "CHANGE", payload: v })}
        aria-label="language"
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

      <Modal
        isOpen={isFormOpen}
        showClose={false}
        variant={ModalVariant.small}
        title="Language Selector"
        actions={[
          <Button key="confirm" variant="primary" onClick={accept}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={cancel}>
            Cancel
          </Button>
        ]}
      >
        <Form>
          <FormGroup
            fieldId="language"
            label="Select language"
            helperText="The selected language will be used for both, the installer and the installed system"
          >
            {buildSelector()}
          </FormGroup>
        </Form>
      </Modal>
    </>
  );
}
