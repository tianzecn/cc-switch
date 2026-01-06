import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import type { Provider } from "@/types";
import type { EnvConflict } from "@/types/env";
import { useProvidersQuery } from "@/lib/query";
import {
  providersApi,
  settingsApi,
  type AppId,
  type ProviderSwitchEvent,
} from "@/lib/api";
import { checkAllEnvConflicts, checkEnvConflicts } from "@/lib/api/env";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useProxyStatus } from "@/hooks/useProxyStatus";
import { useLastValidValue } from "@/hooks/useLastValidValue";
import { extractErrorMessage } from "@/utils/errorUtils";
import { ProviderList } from "@/components/providers/ProviderList";
import { AddProviderDialog } from "@/components/providers/AddProviderDialog";
import { EditProviderDialog } from "@/components/providers/EditProviderDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { EnvWarningBanner } from "@/components/env/EnvWarningBanner";
import UsageScriptModal from "@/components/UsageScriptModal";
import UnifiedMcpPanel from "@/components/mcp/UnifiedMcpPanel";
import PromptPanel from "@/components/prompts/PromptPanel";
import { SkillsPageNew } from "@/components/skills/SkillsPageNew";
import { DeepLinkImportDialog } from "@/components/DeepLinkImportDialog";
import { AgentsPage } from "@/components/agents/AgentsPage";
import { UniversalProviderPanel } from "@/components/universal";
import { CommandsPage } from "@/components/commands";
import { HooksPage } from "@/components/hooks/HooksPage";
import {
  UnifiedNavbar,
  type View,
  type PageActionRefs,
} from "@/components/navbar/UnifiedNavbar";

const DRAG_BAR_HEIGHT = 28; // px
const NAVBAR_HEIGHT = 96; // px (3 rows * 32px)
const CONTENT_TOP_OFFSET = DRAG_BAR_HEIGHT + NAVBAR_HEIGHT;

function App() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeApp, setActiveApp] = useState<AppId>("claude");
  const [currentView, setCurrentView] = useState<View>("providers");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [usageProvider, setUsageProvider] = useState<Provider | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);
  const [envConflicts, setEnvConflicts] = useState<EnvConflict[]>([]);
  const [showEnvBanner, setShowEnvBanner] = useState(false);

  // 使用 Hook 保存最后有效值，用于动画退出期间保持内容显示
  const effectiveEditingProvider = useLastValidValue(editingProvider);
  const effectiveUsageProvider = useLastValidValue(usageProvider);

  const promptPanelRef = useRef<any>(null);
  const mcpPanelRef = useRef<any>(null);
  const skillsPageRef = useRef<any>(null);

  // Page action refs for UnifiedNavbar
  const pageActionRefs: PageActionRefs = {
    promptPanel: promptPanelRef,
    mcpPanel: mcpPanelRef,
    skillsPage: skillsPageRef,
  };

  // 获取代理服务状态
  const {
    isRunning: isProxyRunning,
    takeoverStatus,
    status: proxyStatus,
  } = useProxyStatus();
  // 当前应用的代理是否开启
  const isCurrentAppTakeoverActive = takeoverStatus?.[activeApp] || false;
  // 当前应用代理实际使用的供应商 ID（从 active_targets 中获取）
  const activeProviderId = useMemo(() => {
    const target = proxyStatus?.active_targets?.find(
      (t) => t.app_type === activeApp,
    );
    return target?.provider_id;
  }, [proxyStatus?.active_targets, activeApp]);

  // 获取供应商列表，当代理服务运行时自动刷新
  const { data, isLoading, refetch } = useProvidersQuery(activeApp, {
    isProxyRunning,
  });
  const providers = useMemo(() => data?.providers ?? {}, [data]);
  const currentProviderId = data?.currentProviderId ?? "";
  // 🎯 使用 useProviderActions Hook 统一管理所有 Provider 操作
  const {
    addProvider,
    updateProvider,
    switchProvider,
    deleteProvider,
    saveUsageScript,
  } = useProviderActions(activeApp);

  // 监听来自托盘菜单的切换事件
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unsubscribe = await providersApi.onSwitched(
          async (event: ProviderSwitchEvent) => {
            if (event.appType === activeApp) {
              await refetch();
            }
          },
        );
      } catch (error) {
        console.error("[App] Failed to subscribe provider switch event", error);
      }
    };

    setupListener();
    return () => {
      unsubscribe?.();
    };
  }, [activeApp, refetch]);

  // 监听统一供应商同步事件，刷新所有应用的供应商列表
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unsubscribe = await listen("universal-provider-synced", async () => {
          // 统一供应商同步后刷新所有应用的供应商列表
          // 使用 invalidateQueries 使所有 providers 查询失效
          await queryClient.invalidateQueries({ queryKey: ["providers"] });
          // 同时更新托盘菜单
          try {
            await providersApi.updateTrayMenu();
          } catch (error) {
            console.error("[App] Failed to update tray menu", error);
          }
        });
      } catch (error) {
        console.error(
          "[App] Failed to subscribe universal-provider-synced event",
          error,
        );
      }
    };

    setupListener();
    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);

  // 应用启动时检测所有应用的环境变量冲突
  useEffect(() => {
    const checkEnvOnStartup = async () => {
      try {
        const allConflicts = await checkAllEnvConflicts();
        const flatConflicts = Object.values(allConflicts).flat();

        if (flatConflicts.length > 0) {
          setEnvConflicts(flatConflicts);
          const dismissed = sessionStorage.getItem("env_banner_dismissed");
          if (!dismissed) {
            setShowEnvBanner(true);
          }
        }
      } catch (error) {
        console.error(
          "[App] Failed to check environment conflicts on startup:",
          error,
        );
      }
    };

    checkEnvOnStartup();
  }, []);

  // 应用启动时检查是否刚完成了配置迁移
  useEffect(() => {
    const checkMigration = async () => {
      try {
        const migrated = await invoke<boolean>("get_migration_result");
        if (migrated) {
          toast.success(
            t("migration.success", { defaultValue: "配置迁移成功" }),
            { closeButton: true },
          );
        }
      } catch (error) {
        console.error("[App] Failed to check migration result:", error);
      }
    };

    checkMigration();
  }, [t]);

  // 应用启动时检查是否刚完成了 Skills 自动导入（统一管理 SSOT）
  useEffect(() => {
    const checkSkillsMigration = async () => {
      try {
        const result = await invoke<{ count: number; error?: string } | null>(
          "get_skills_migration_result",
        );
        if (result?.error) {
          toast.error(t("migration.skillsFailed"), {
            description: t("migration.skillsFailedDescription"),
            closeButton: true,
          });
          console.error("[App] Skills SSOT migration failed:", result.error);
          return;
        }
        if (result && result.count > 0) {
          toast.success(t("migration.skillsSuccess", { count: result.count }), {
            closeButton: true,
          });
          await queryClient.invalidateQueries({ queryKey: ["skills"] });
        }
      } catch (error) {
        console.error("[App] Failed to check skills migration result:", error);
      }
    };

    checkSkillsMigration();
  }, [t, queryClient]);

  // 切换应用时检测当前应用的环境变量冲突
  useEffect(() => {
    const checkEnvOnSwitch = async () => {
      try {
        const conflicts = await checkEnvConflicts(activeApp);

        if (conflicts.length > 0) {
          // 合并新检测到的冲突
          setEnvConflicts((prev) => {
            const existingKeys = new Set(
              prev.map((c) => `${c.varName}:${c.sourcePath}`),
            );
            const newConflicts = conflicts.filter(
              (c) => !existingKeys.has(`${c.varName}:${c.sourcePath}`),
            );
            return [...prev, ...newConflicts];
          });
          const dismissed = sessionStorage.getItem("env_banner_dismissed");
          if (!dismissed) {
            setShowEnvBanner(true);
          }
        }
      } catch (error) {
        console.error(
          "[App] Failed to check environment conflicts on app switch:",
          error,
        );
      }
    };

    checkEnvOnSwitch();
  }, [activeApp]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (event.key !== "," || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      setCurrentView("settings");
    };

    window.addEventListener("keydown", handleGlobalShortcut);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
    };
  }, []);

  // 打开网站链接
  const handleOpenWebsite = async (url: string) => {
    try {
      await settingsApi.openExternal(url);
    } catch (error) {
      const detail =
        extractErrorMessage(error) ||
        t("notifications.openLinkFailed", {
          defaultValue: "链接打开失败",
        });
      toast.error(detail);
    }
  };

  // 编辑供应商
  const handleEditProvider = async (provider: Provider) => {
    await updateProvider(provider);
    setEditingProvider(null);
  };

  // 确认删除供应商
  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await deleteProvider(confirmDelete.id);
    setConfirmDelete(null);
  };

  // 复制供应商
  const handleDuplicateProvider = async (provider: Provider) => {
    // 1️⃣ 计算新的 sortIndex：如果原供应商有 sortIndex，则复制它
    const newSortIndex =
      provider.sortIndex !== undefined ? provider.sortIndex + 1 : undefined;

    const duplicatedProvider: Omit<Provider, "id" | "createdAt"> = {
      name: `${provider.name} copy`,
      settingsConfig: JSON.parse(JSON.stringify(provider.settingsConfig)), // 深拷贝
      websiteUrl: provider.websiteUrl,
      category: provider.category,
      sortIndex: newSortIndex, // 复制原 sortIndex + 1
      meta: provider.meta
        ? JSON.parse(JSON.stringify(provider.meta))
        : undefined, // 深拷贝
      icon: provider.icon,
      iconColor: provider.iconColor,
    };

    // 2️⃣ 如果原供应商有 sortIndex，需要将后续所有供应商的 sortIndex +1
    if (provider.sortIndex !== undefined) {
      const updates = Object.values(providers)
        .filter(
          (p) =>
            p.sortIndex !== undefined &&
            p.sortIndex >= newSortIndex! &&
            p.id !== provider.id,
        )
        .map((p) => ({
          id: p.id,
          sortIndex: p.sortIndex! + 1,
        }));

      // 先更新现有供应商的 sortIndex，为新供应商腾出位置
      if (updates.length > 0) {
        try {
          await providersApi.updateSortOrder(updates, activeApp);
        } catch (error) {
          console.error("[App] Failed to update sort order", error);
          toast.error(
            t("provider.sortUpdateFailed", {
              defaultValue: "排序更新失败",
            }),
          );
          return; // 如果排序更新失败，不继续添加
        }
      }
    }

    // 3️⃣ 添加复制的供应商
    await addProvider(duplicatedProvider);
  };

  // 导入配置成功后刷新
  const handleImportSuccess = async () => {
    try {
      // 导入会影响所有应用的供应商数据：刷新所有 providers 缓存
      await queryClient.invalidateQueries({
        queryKey: ["providers"],
        refetchType: "all",
      });
      await queryClient.refetchQueries({
        queryKey: ["providers"],
        type: "all",
      });
    } catch (error) {
      console.error("[App] Failed to refresh providers after import", error);
      await refetch();
    }
    try {
      await providersApi.updateTrayMenu();
    } catch (error) {
      console.error("[App] Failed to refresh tray menu", error);
    }
  };

  const renderContent = () => {
    const content = (() => {
      switch (currentView) {
        case "settings":
          return (
            <SettingsPage
              open={true}
              onOpenChange={() => setCurrentView("providers")}
              onImportSuccess={handleImportSuccess}
            />
          );
        case "prompts":
          return (
            <PromptPanel
              ref={promptPanelRef}
              open={true}
              onOpenChange={() => setCurrentView("providers")}
              appId={activeApp}
            />
          );
        case "skills":
          return <SkillsPageNew ref={skillsPageRef} />;
        case "mcp":
          return (
            <UnifiedMcpPanel
              ref={mcpPanelRef}
              onOpenChange={() => setCurrentView("providers")}
            />
          );
        case "agents":
          return <AgentsPage />;
        case "commands":
          return <CommandsPage />;
        case "hooks":
          return <HooksPage />;
        case "universal":
          return (
            <div className="mx-auto max-w-[56rem] px-5 pt-4">
              <UniversalProviderPanel />
            </div>
          );
        default:
          return (
            <div className="mx-auto max-w-[56rem] px-5 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
              {/* 独立滚动容器 - 解决 Linux/Ubuntu 下 DndContext 与滚轮事件冲突 */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden pb-12 px-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeApp}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <ProviderList
                      providers={providers}
                      currentProviderId={currentProviderId}
                      appId={activeApp}
                      isLoading={isLoading}
                      isProxyRunning={isProxyRunning}
                      isProxyTakeover={
                        isProxyRunning && isCurrentAppTakeoverActive
                      }
                      activeProviderId={activeProviderId}
                      onSwitch={switchProvider}
                      onEdit={setEditingProvider}
                      onDelete={setConfirmDelete}
                      onDuplicate={handleDuplicateProvider}
                      onConfigureUsage={setUsageProvider}
                      onOpenWebsite={handleOpenWebsite}
                      onCreate={() => setIsAddOpen(true)}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          );
      }
    })();

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30"
      style={{ overflowX: "hidden", paddingTop: CONTENT_TOP_OFFSET }}
    >
      {/* 全局拖拽区域（顶部 28px），避免上边框无法拖动 */}
      <div
        className="fixed top-0 left-0 right-0 z-[60]"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag", height: DRAG_BAR_HEIGHT } as any}
      />
      {/* 环境变量警告横幅 */}
      {showEnvBanner && envConflicts.length > 0 && (
        <EnvWarningBanner
          conflicts={envConflicts}
          onDismiss={() => {
            setShowEnvBanner(false);
            sessionStorage.setItem("env_banner_dismissed", "true");
          }}
          onDeleted={async () => {
            // 删除后重新检测
            try {
              const allConflicts = await checkAllEnvConflicts();
              const flatConflicts = Object.values(allConflicts).flat();
              setEnvConflicts(flatConflicts);
              if (flatConflicts.length === 0) {
                setShowEnvBanner(false);
              }
            } catch (error) {
              console.error(
                "[App] Failed to re-check conflicts after deletion:",
                error,
              );
            }
          }}
        />
      )}

      <UnifiedNavbar
        currentView={currentView}
        onViewChange={setCurrentView}
        activeApp={activeApp}
        onAppChange={setActiveApp}
        pageActionRefs={pageActionRefs}
        onAddProvider={() => setIsAddOpen(true)}
      />

      <main className="flex-1 pb-12 animate-fade-in ">
        <div className="pb-12">{renderContent()}</div>
      </main>

      <AddProviderDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        appId={activeApp}
        onSubmit={addProvider}
      />

      <EditProviderDialog
        open={Boolean(editingProvider)}
        provider={effectiveEditingProvider}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProvider(null);
          }
        }}
        onSubmit={handleEditProvider}
        appId={activeApp}
        isProxyTakeover={isProxyRunning && isCurrentAppTakeoverActive}
      />

      {effectiveUsageProvider && (
        <UsageScriptModal
          provider={effectiveUsageProvider}
          appId={activeApp}
          isOpen={Boolean(usageProvider)}
          onClose={() => setUsageProvider(null)}
          onSave={(script) => {
            if (usageProvider) {
              void saveUsageScript(usageProvider, script);
            }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        title={t("confirm.deleteProvider")}
        message={
          confirmDelete
            ? t("confirm.deleteProviderMessage", {
                name: confirmDelete.name,
              })
            : ""
        }
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDelete(null)}
      />

      <DeepLinkImportDialog />
    </div>
  );
}

export default App;
