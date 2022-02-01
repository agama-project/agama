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

export default function LanguageSelector({ value, onChange = () => {} }) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [language, setLanguage] = useState(value);
  const [options, setOptions] = useState([]);
  const client = useInstallerClient();

  useEffect(() => {
    client.getLanguages().then(setOptions);
  }, []);

  const onOpen = () => {
    setLanguage(value);
    setFormOpen(true);
  }

  const onClose = () => {
    setFormOpen(false);
  }

  const applyChanges = () => {
    onChange(language);
    onClose();
  }

  const label = () => {
    if (options.length === 0) {
      return value;
    }

    const selectedLanguage = options.find(lang => lang.id === value)

    return selectedLanguage ? selectedLanguage.name : value;
  }

  const buildSelector = () => {
    const selectorOptions = options.map(lang => (
      <FormSelectOption key={lang.id} value={lang.id} label={lang.name} />
    ));

    return (
      <FormSelect
        value={language}
        onChange={(value) => setLanguage(value)}
        aria-label="language"
      >
        {selectorOptions}
      </FormSelect>
    );
  };

  return (
    <>
      <Button variant="link" onClick={onOpen}>
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
          <Button key="cancel" variant="link" onClick={onClose}>
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
