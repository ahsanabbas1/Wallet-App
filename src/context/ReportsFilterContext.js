import React, { createContext, useState, useContext } from 'react';

const ReportsFilterContext = createContext();

export const useReportsFilter = () => useContext(ReportsFilterContext);

export const ReportsFilterProvider = ({ children }) => {
  const [filterPeriod, setFilterPeriod] = useState('MONTH');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');
  const [isCustomActive, setIsCustomActive] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [ledgerView, setLedgerView] = useState('TABLE');

  return (
    <ReportsFilterContext.Provider
      value={{
        filterPeriod, setFilterPeriod,
        appliedStart, setAppliedStart,
        appliedEnd, setAppliedEnd,
        isCustomActive, setIsCustomActive,
        activeTab, setActiveTab,
        ledgerView, setLedgerView,
      }}
    >
      {children}
    </ReportsFilterContext.Provider>
  );
};
