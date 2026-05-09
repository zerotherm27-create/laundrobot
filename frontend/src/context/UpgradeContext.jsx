import { createContext, useContext, useState } from 'react';

const UpgradeContext = createContext({ openUpgradeModal: () => {} });

export function UpgradeProvider({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <UpgradeContext.Provider value={{ openUpgradeModal: () => setOpen(true), upgradeModalOpen: open, setUpgradeModalOpen: setOpen }}>
      {children}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  return useContext(UpgradeContext);
}
