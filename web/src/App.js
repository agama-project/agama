import React, { useEffect, useState } from 'react';

import {
  ChakraProvider,
  Box,
  Text,
  VStack,
  Heading,
  Flex,
  Spacer,
  Divider,
  Button,
  Progress,
  theme,
} from '@chakra-ui/react';
import { ColorModeSwitcher } from './ColorModeSwitcher';

import Category from './Category';
import LanguageSelector from './LanguageSelector';
import TargetSelector from './TargetSelector';
import ProductSelector from './ProductSelector';
import Proposal from './Proposal';

// FIXME: improve how icons are managed
import {
  Archive,
  HardDrive,
  Languages,
  Clock
} from 'lucide-react';

import {
  useInstallerState, useInstallerDispatch, loadInstallation, loadStorage, loadL10n, loadSoftware,
  loadDisks, setOptions, loadOptions, registerWebSocketHandler, startInstallation
} from './context/installer';

const STEPS = 3; // fake number of installation steps

function App() {
  const dispatch = useInstallerDispatch();
  const { installation, storage, l10n, software } = useInstallerState();

  useEffect(() => {
    loadStorage(dispatch);
    loadDisks(dispatch);
    loadL10n(dispatch);
    loadSoftware(dispatch);
    loadOptions(dispatch);
    loadInstallation(dispatch);
    registerWebSocketHandler(event => {
      console.log("WebSocket Event", event);
      const { data } = event;
      const changedKeys = Object.keys(JSON.parse(data));
      if (changedKeys.includes("disk")) {
        loadStorage(dispatch);
      }

      if (changedKeys.includes("status")) {
        loadInstallation(dispatch);
      }
    });
  }, []);

  const isInstalling = installation.status != "0";

  return (
    <ChakraProvider theme={theme}>
        <Box minH="100vh" p={3}>
          <Flex>
            <Spacer />
            <ColorModeSwitcher />
          </Flex>
          <VStack spacing={8}>
            <Heading as="h1">Welcome to $INSTALLER-80</Heading>
            <Divider />

            <Category title="Language" icon={Languages}>
              <LanguageSelector
                value={l10n.language}
                options={l10n.languages}
                onChange={(language) => setOptions({ language }, dispatch)} />
            </Category>

            <Category title="Target" icon={HardDrive}>
              <TargetSelector
                value={storage.disk || "Select a device"}
                options={storage.disks}
                onChange={disk => setOptions({ disk }, dispatch)}
              />
              <Proposal data={storage.proposal}/>
            </Category>

            <Category title="Product" icon={Archive}>
              <ProductSelector
                value={software.product || "Select a product"}
                options={software.products}
                onChange={(product) => setOptions({ product }, dispatch)}
              />
            </Category>

            { isInstalling &&
              <Category title="Progress" icon={Clock} >
                <Progress hasStripe value={Math.round(parseInt(installation.status) / STEPS * 100)} />
              </Category> }
          </VStack>

          <Flex p={20}>
            <Spacer />
            <Button colorScheme="teal"
                    size="lg"
                    disabled={isInstalling}
                    onClick={() => startInstallation(dispatch)}>
              Install
            </Button>
            { isInstalling }
          </Flex>
        </Box>
    </ChakraProvider>
  );
}

export default App;
