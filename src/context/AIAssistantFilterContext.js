import React, { createContext, useState, useContext } from 'react';

const AIAssistantFilterContext = createContext();

export const useAIAssistantFilter = () => useContext(AIAssistantFilterContext);

export const AIAssistantFilterProvider = ({ children }) => {
  const [period, setPeriod] = useState('1M');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  return (
    <AIAssistantFilterContext.Provider
      value={{
        period, setPeriod,
        customStartDate, setCustomStartDate,
        customEndDate, setCustomEndDate,
      }}
    >
      {children}
    </AIAssistantFilterContext.Provider>
  );
};
