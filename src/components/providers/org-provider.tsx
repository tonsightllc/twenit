"use client";

import { createContext, useContext } from "react";

interface OrgContextValue {
  orgId: string | null;
  userRole: string | null;
}

const OrgContext = createContext<OrgContextValue>({
  orgId: null,
  userRole: null,
});

export function OrgProvider({
  children,
  orgId,
  userRole,
}: {
  children: React.ReactNode;
  orgId: string | null;
  userRole: string | null;
}) {
  return (
    <OrgContext.Provider value={{ orgId, userRole }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
