'use client';

import { SWRConfig } from 'swr';
import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        refreshInterval: 3000,
        fetcher: (resource, init) =>
          fetch(resource, init).then(res => res.json())
      }}
    >
      {children}
    </SWRConfig>
  );
} 