import React from 'react';
import { screen } from '@testing-library/react';
import { render } from './test-utils';
import Overview from './Overview';

test('renders the Overview', () => {
  render(<Overview />);
  const title = screen.getByText(/Welcome to D-Installer/i);
  expect(title).toBeInTheDocument();
});
