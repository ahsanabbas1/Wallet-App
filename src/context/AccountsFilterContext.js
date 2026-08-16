import React, { createContext, useState, useContext } from 'react';

const AccountsFilterContext = createContext();

export const useAccountsFilter = () => useContext(AccountsFilterContext);

export const AccountsFilterProvider = ({ children }) => {
  const [detailsTab, setDetailsTab] = useState('accounts');
  const [detailsAccountId, setDetailsAccountId] = useState(null);
  const [detailsPeriod, setDetailsPeriod] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  return (
    <AccountsFilterContext.Provider
      value={{
        detailsTab, setDetailsTab,
        detailsAccountId, setDetailsAccountId,
        detailsPeriod, setDetailsPeriod,
        customStartDate, setCustomStartDate,
        customEndDate, setCustomEndDate,
      }}
    >
      {children}
    </AccountsFilterContext.Provider>
  );
};
