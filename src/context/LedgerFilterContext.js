import React, { createContext, useState, useContext } from 'react';

const LedgerFilterContext = createContext();

export const useLedgerFilter = () => useContext(LedgerFilterContext);

export const LedgerFilterProvider = ({ children }) => {
  const [filterPeriod, setFilterPeriod] = useState('1M');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  return (
    <LedgerFilterContext.Provider
      value={{
        filterPeriod,
        setFilterPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
      }}
    >
      {children}
    </LedgerFilterContext.Provider>
  );
};
