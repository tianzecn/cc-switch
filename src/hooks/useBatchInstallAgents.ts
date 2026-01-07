import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { DiscoverableAgent } from "@/hooks/useAgents";
import { useInstallAgent } from "@/hooks/useAgents";
import { useTranslation } from "react-i18next";

/** 批量安装状态 */
export interface BatchInstallAgentsState {
  /** 是否正在安装 */
  isInstalling: boolean;
  /** 总数 */
  total: number;
  /** 当前进度（已完成数） */
  current: number;
  /** 当前正在安装的 Agent 名称 */
  currentName: string | null;
  /** 失败数量 */
  failed: number;
  /** 失败的 Agent 列表 */
  failedAgents: string[];
}

/** 批量安装 Hook 返回值 */
export interface UseBatchInstallAgentsReturn {
  /** 当前状态 */
  state: BatchInstallAgentsState;
  /** 开始批量安装 */
  startBatchInstall: (
    agents: DiscoverableAgent[],
    installedIds: Set<string>,
  ) => Promise<void>;
  /** 取消安装 */
  cancelInstall: () => void;
  /** 重置状态 */
  reset: () => void;
}

const initialState: BatchInstallAgentsState = {
  isInstalling: false,
  total: 0,
  current: 0,
  currentName: null,
  failed: 0,
  failedAgents: [],
};

/**
 * Agents 批量安装 Hook
 * 支持顺序安装、跳过已安装、进度追踪、取消操作
 */
export function useBatchInstallAgents(): UseBatchInstallAgentsReturn {
  const { t } = useTranslation();
  const [state, setState] = useState<BatchInstallAgentsState>(initialState);
  const cancelledRef = useRef(false);
  const installMutation = useInstallAgent();

  const reset = useCallback(() => {
    setState(initialState);
    cancelledRef.current = false;
  }, []);

  const cancelInstall = useCallback(() => {
    cancelledRef.current = true;
    setState((prev) => ({
      ...prev,
      isInstalling: false,
      currentName: null,
    }));
  }, []);

  const startBatchInstall = useCallback(
    async (agents: DiscoverableAgent[], installedIds: Set<string>) => {
      // 过滤已安装的 agents
      const toInstall = agents.filter((agent) => {
        const id = agent.namespace
          ? `${agent.namespace}/${agent.filename}`
          : agent.filename;
        return !installedIds.has(id);
      });

      if (toInstall.length === 0) {
        toast.info(
          t("agents.batch.allInstalled", "All agents are already installed"),
        );
        return;
      }

      // 初始化状态
      cancelledRef.current = false;
      setState({
        isInstalling: true,
        total: toInstall.length,
        current: 0,
        currentName: null,
        failed: 0,
        failedAgents: [],
      });

      let successCount = 0;
      let failCount = 0;
      const failedNames: string[] = [];

      // 顺序安装
      for (let i = 0; i < toInstall.length; i++) {
        // 检查是否取消
        if (cancelledRef.current) {
          break;
        }

        const agent = toInstall[i];

        // 更新当前安装状态
        setState((prev) => ({
          ...prev,
          current: i,
          currentName: agent.name,
        }));

        try {
          await installMutation.mutateAsync({
            agent,
            currentApp: "claude", // 默认安装时启用 Claude
          });
          successCount++;
        } catch (error) {
          failCount++;
          failedNames.push(agent.name);
          console.error(`Failed to install ${agent.name}:`, error);
        }

        // 更新进度
        setState((prev) => ({
          ...prev,
          current: i + 1,
          failed: failCount,
          failedAgents: [...failedNames],
        }));
      }

      // 安装完成
      setState((prev) => ({
        ...prev,
        isInstalling: false,
        currentName: null,
      }));

      // 显示汇总 toast
      if (cancelledRef.current) {
        toast.info(t("agents.batch.cancelled", "Installation cancelled"), {
          description: t(
            "agents.batch.cancelledDetail",
            "Installed {{success}} of {{total}} agents",
            { success: successCount, total: toInstall.length },
          ),
        });
      } else if (failCount === 0) {
        toast.success(
          t("agents.batch.success", "All agents installed successfully"),
          {
            description: t(
              "agents.batch.successDetail",
              "Successfully installed {{count}} agents",
              { count: successCount },
            ),
          },
        );
      } else {
        toast.warning(
          t("agents.batch.partial", "Installation completed with errors"),
          {
            description: t(
              "agents.batch.partialDetail",
              "Installed {{success}} agents, {{failed}} failed",
              { success: successCount, failed: failCount },
            ),
            duration: 10000,
          },
        );
      }
    },
    [installMutation, t],
  );

  return {
    state,
    startBatchInstall,
    cancelInstall,
    reset,
  };
}

export default useBatchInstallAgents;
