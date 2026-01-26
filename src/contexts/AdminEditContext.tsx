import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useAdminRole } from "@/hooks/useAdminRole";

interface AdminEditContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AdminEditContext = createContext<AdminEditContextType | undefined>(undefined);

export const AdminEditProvider = ({ children }: { children: ReactNode }) => {
  const { isAdmin, isLoading } = useAdminRole();
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = useCallback(() => {
    if (isAdmin) {
      setIsEditMode((prev) => !prev);
    }
  }, [isAdmin]);

  return (
    <AdminEditContext.Provider value={{ isEditMode, toggleEditMode, isAdmin, isLoading }}>
      {children}
    </AdminEditContext.Provider>
  );
};

export const useAdminEdit = () => {
  const context = useContext(AdminEditContext);
  if (!context) {
    throw new Error("useAdminEdit must be used within AdminEditProvider");
  }
  return context;
};
