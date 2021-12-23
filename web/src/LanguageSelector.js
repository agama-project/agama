import { useState } from 'react';

import {
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Select,
  Text,
  useDisclosure,
} from "@chakra-ui/react"

export default function LanguageSelector({ value, options = [], onChange = () => {} }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [language, setLanguage] = useState(value);

  // FIXME: find other way to keep installer option in sync while using the
  // controlled React select#value=
  // (https://reactjs.org/docs/forms.html#the-select-tag)
  const open = () => {
    setLanguage(value);
    onOpen();
  }

  const applyChanges = () => {
    onChange(language);
    onClose();
  }

  const label = () => {
    if (options.length == 0) {
      return value;
    }

    const selectedLanguage = options.find(lang => lang.id === value)

    return selectedLanguage ? selectedLanguage.name : value;
  }

  const buildSelector = () => {
    const selectorOptions = options.map(lang => (
      <option key={lang.id} value={lang.id}>
        {lang.name}
      </option>
    ));

    return (
      <Select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}>
        {selectorOptions}
      </Select>
    );
  };

  return (
    <>
      <Link color="teal" onClick={open}>
        <Text fontSize="lg">{label()}</Text>
      </Link>

      <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Language Selector</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl id="language">
              <FormLabel>Select desired language</FormLabel>
              { buildSelector() }
              <FormHelperText>The selected language will be used for both, the installer
      and the installed system</FormHelperText>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="teal" mr={3} onClick={applyChanges}>
              Save
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
