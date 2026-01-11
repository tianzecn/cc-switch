import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { DiscoverableCommand } from "@/hooks/useCommands";
import { useInstallCommand } from "@/hooks/useCommands";
import { useTranslation } from "react-i18next";

/** 批量安装状态 */
export interface BatchInstallCommandsState {
  /** 是否正在安装 */
  isInstalling: boolean;
  /** 总数 */
  total: number;
  /** 当前进度（已完成数） */
  current: number;
  /** 当前正在安装的命令名称 */
  currentName: string | null;
  /** 失败数量 */
  failed: number;
  /** 失败的命令列表 */
  failedCommands: string[];
}

/** 批量安装 Hook 返回值 */
export interface UseBatchInstallCommandsReturn {
  /** 当前状态 */
  state: BatchInstallCommandsState;
  /** 开始批量安装 */
  startBatchInstall: (
    commands: DiscoverableCommand[],
    installedIds: Set<string>,
  ) => Promise<void>;
  /** 取消安装 */
  cancelInstall: () => void;
  /** 重置状态 */
  reset: () => void;
}

const initialState: BatchInstallCommandsState = {
  isInstalling: false,
  total: 0,
  current: 0,
  currentName: null,
  failed: 0,
  failedCommands: [],
};

/**
 * Commands 批量安装 Hook
 * 支持顺序安装、跳过已安装、进度追踪、取消操作
 */
export function useBatchInstallCommands(): UseBatchInstallCommandsReturn {
  const { t } = useTranslation();
  const [state, setState] = useState<BatchInstallCommandsState>(initialState);
  const cancelledRef = useRef(false);
  const installMutation = useInstallCommand();

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
    async (commands: DiscoverableCommand[], installedIds: Set<string>) => {
      // 过滤已安装的命令
      const toInstall = commands.filter((cmd) => {
        const id = cmd.namespace
          ? `${cmd.namespace}/${cmd.filename}`
          : cmd.filename;
        return !installedIds.has(id);
      });

      if (toInstall.length === 0) {
        toast.info(
          t(
            "commands.batch.allInstalled",
            "All commands are already installed",
          ),
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
        failedCommands: [],
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

        const command = toInstall[i];

        // 更新当前安装状态
        setState((prev) => ({
          ...prev,
          current: i,
          currentName: command.name,
        }));

        try {
          await installMutation.mutateAsync({
            command,
            currentApp: "claude", // 默认安装时启用 Claude
          });
          successCount++;
        } catch (error) {
          failCount++;
          failedNames.push(command.name);
          console.error(`Failed to install ${command.name}:`, error);
        }

        // 更新进度
        setState((prev) => ({
          ...prev,
          current: i + 1,
          failed: failCount,
          failedCommands: [...failedNames],
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
        toast.info(t("commands.batch.cancelled", "Installation cancelled"), {
          description: t(
            "commands.batch.cancelledDetail",
            "Installed {{success}} of {{total}} commands",
            { success: successCount, total: toInstall.length },
          ),
        });
      } else if (failCount === 0) {
        toast.success(
          t("commands.batch.success", "All commands installed successfully"),
          {
            description: t(
              "commands.batch.successDetail",
              "Successfully installed {{count}} commands",
              { count: successCount },
            ),
          },
        );
      } else {
        toast.warning(
          t("commands.batch.partial", "Installation completed with errors"),
          {
            description: t(
              "commands.batch.partialDetail",
              "Installed {{success}} commands, {{failed}} failed",
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

export default useBatchInstallCommands;
