import { useState, useEffect } from 'react';
import { useInstallerClient } from './context/installer';

import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant
} from "@patternfly/react-core"

export default function LanguageSelector() {
  const [isFormOpen, setFormOpen] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [language, setLanguage] = useState("");
  const [initialLanguage, setInitialLanguage] = useState("");
  const client = useInstallerClient();

  useEffect(async () => {
    const languages = await client.getLanguages();
    const language = await client.getOption("Language");
    setLanguages(languages);
    setLanguage(language);
    setInitialLanguage(language);
  }, []);

  const open = () => setFormOpen(true);
  const close = () => setFormOpen(false);

  const onCancel = () => {
    setLanguage(initialLanguage);
    close();
  }

  const applyChanges = async () => {
    // TODO: handle errors
    await client.setOption("Language", language);
    close();
  }

  const label = () => {
    const selectedLanguage = languages.find(lang => lang.id === language);
    return selectedLanguage ? selectedLanguage.name : "Select language";
  }

  const buildSelector = () => {
    const selectorOptions = languages.map(lang => (
      <FormSelectOption key={lang.id} value={lang.id} label={lang.name} />
    ));

    return (
      <FormSelect
        value={language}
        onChange={setLanguage}
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
          <Button key="confirm" variant="primary" onClick={applyChanges}>
            Confirm
          </Button>,
          <Button key="cancel" variant="link" onClick={onCancel}>
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
            { buildSelector() }
          </FormGroup>
        </Form>
      </Modal>
    </>
  )
}
