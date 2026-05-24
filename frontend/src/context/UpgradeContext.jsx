import { createContext, useContext, useState } from 'react';

const UpgradeContext = createContext({
  openUpgradeModal: () => {},
  upgradeModalOpen: false,
  setUpgradeModalOpen: () => {},
  defaultUpgradeTier: 'growth',
  plan: 'starter',
  isPro: false,
  isGrowthOrAbove: false,
});

export function UpgradeProvider({ children, plan = 'starter' }) {
  const [open,    setOpen]    = useState(false);
  const [defTier, setDefTier] = useState('growth');

  function openUpgradeModal(tier) {
    if (tier) setDefTier(tier);
    setOpen(true);
  }

  return (
    <UpgradeContext.Provider value={{
      openUpgradeModal,
      upgradeModalOpen:    open,
      setUpgradeModalOpen: setOpen,
      defaultUpgradeTier:  defTier,
      plan,
      isPro:            plan === 'pro',
      isGrowthOrAbove:  plan === 'growth' || plan === 'pro',
    }}>
      {children}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  return useContext(UpgradeContext);
}

// Convenience alias used by Finance.jsx and Inventory.jsx
export { useUpgrade as usePlan };
