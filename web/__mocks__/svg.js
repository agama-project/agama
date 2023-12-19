import React from 'react';

export default ({...props}) => (
  // Simple SVG square based on a wikimedia example https://commons.wikimedia.org/wiki/SVG_examples
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="28" height="28" {...props}>
    <rect x="0" y="0" width="28" height="28" />
  </svg>
);
