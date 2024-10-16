// import React, { useState } from 'react';

// Unfortunately the using the state does not work, it crashes at runtime :-(

export default function Plugin() {
  // const [isOpen, setIsOpen] = useState(true);

  // if (!isOpen) return null;

  return (
    <div>
      <p>This is an example plugin.</p>
      {/* <button onClick={() => setIsOpen(false)}>Close</button> */}
    </div>
  );
};
