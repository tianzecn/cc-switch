/**
 * 应用程序自动升级 Context
 *
 * 集成 useAppUpdater Hook 和 UpdateDialog 组件
 * 提供全局的应用更新状态管理
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useAppUpdater, type UpdaterPhase } from "@/hooks/useAppUpdater";
import { UpdateDialog } from "@/components/updater";

interface AppUpdaterContextValue {
  // 状态
  phase: UpdaterPhase;
  hasUpdate: boolean;
  currentVersion: string;

  // 操作
  openUpdateDialog: () => void;
  checkUpdate: () => Promise<void>;
}

const AppUpdaterContext = createContext<AppUpdaterContextValue | undefined>(
  undefined,
);

export function AppUpdaterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const updater = useAppUpdater();

  // 当检测到更新时自动打开对话框
  React.useEffect(() => {
    if (updater.phase === "available") {
      setIsDialogOpen(true);
    }
  }, [updater.phase]);

  // 手动打开对话框并检查更新
  const openUpdateDialog = useCallback(() => {
    setIsDialogOpen(true);
    if (
      updater.phase === "idle" ||
      updater.phase === "upToDate" ||
      updater.phase === "error"
    ) {
      void updater.checkUpdate();
    }
  }, [updater]);

  // 关闭对话框
  const handleDismiss = useCallback(() => {
    updater.dismissUpdate();
    setIsDialogOpen(false);
  }, [updater]);

  // 是否有可用更新
  const hasUpdate = useMemo(() => {
    return (
      updater.phase === "available" ||
      updater.phase === "downloading" ||
      updater.phase === "downloaded"
    );
  }, [updater.phase]);

  // 显示对话框的条件
  const shouldShowDialog = useMemo(() => {
    return (
      isDialogOpen &&
      (updater.phase === "checking" ||
        updater.phase === "available" ||
        updater.phase === "downloading" ||
        updater.phase === "downloaded" ||
        updater.phase === "installing" ||
        updater.phase === "restarting" ||
        updater.phase === "error")
    );
  }, [isDialogOpen, updater.phase]);

  const contextValue: AppUpdaterContextValue = useMemo(
    () => ({
      phase: updater.phase,
      hasUpdate,
      currentVersion: updater.currentVersion,
      openUpdateDialog,
      checkUpdate: updater.checkUpdate,
    }),
    [
      updater.phase,
      hasUpdate,
      updater.currentVersion,
      openUpdateDialog,
      updater.checkUpdate,
    ],
  );

  return (
    <AppUpdaterContext.Provider value={contextValue}>
      {children}

      <UpdateDialog
        isOpen={shouldShowDialog}
        phase={updater.phase}
        updateInfo={updater.updateInfo}
        progress={updater.progress}
        error={updater.error}
        currentVersion={updater.currentVersion}
        onDownload={updater.downloadUpdate}
        onInstall={updater.installUpdate}
        onSkip={updater.skipVersion}
        onRetry={updater.retryLastAction}
        onDismiss={handleDismiss}
      />
    </AppUpdaterContext.Provider>
  );
}

export function useAppUpdaterContext() {
  const context = useContext(AppUpdaterContext);
  if (!context) {
    throw new Error(
      "useAppUpdaterContext must be used within AppUpdaterProvider",
    );
  }
  return context;
}
