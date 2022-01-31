import React from 'react';
import { render } from '@testing-library/react';
import { InstallerProvider } from './context/installer';

const AllProviders = ({ children }) => (
  <InstallerProvider>{children}</InstallerProvider>
);

const customRender = (ui, options) =>
  render(ui, { wrapper: AllProviders, ...options });

export { customRender as render };
