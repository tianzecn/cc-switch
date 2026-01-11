import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { DiscoverableSkill } from "@/lib/api/skills";
import type { AppType } from "@/hooks/useSkills";
import { useInstallSkill } from "@/hooks/useSkills";
import { useTranslation } from "react-i18next";

/** 批量安装状态 */
export interface BatchInstallState {
  /** 是否正在安装 */
  isInstalling: boolean;
  /** 总数 */
  total: number;
  /** 当前进度（已完成数） */
  current: number;
  /** 当前正在安装的技能名称 */
  currentName: string | null;
  /** 失败数量 */
  failed: number;
  /** 失败的技能列表 */
  failedSkills: string[];
}

/** 批量安装 Hook 返回值 */
export interface UseBatchInstallReturn {
  /** 当前状态 */
  state: BatchInstallState;
  /** 开始批量安装 */
  startBatchInstall: (
    skills: DiscoverableSkill[],
    installedDirs: Set<string>,
    currentApp: AppType,
  ) => Promise<void>;
  /** 取消安装 */
  cancelInstall: () => void;
  /** 重置状态 */
  reset: () => void;
}

const initialState: BatchInstallState = {
  isInstalling: false,
  total: 0,
  current: 0,
  currentName: null,
  failed: 0,
  failedSkills: [],
};

/**
 * 批量安装 Hook
 * 支持顺序安装、跳过已安装、进度追踪、取消操作
 */
export function useBatchInstall(): UseBatchInstallReturn {
  const { t } = useTranslation();
  const [state, setState] = useState<BatchInstallState>(initialState);
  const cancelledRef = useRef(false);
  const installMutation = useInstallSkill();

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
    async (
      skills: DiscoverableSkill[],
      installedDirs: Set<string>,
      currentApp: AppType,
    ) => {
      // 过滤已安装的技能
      const toInstall = skills.filter((skill) => {
        const installName =
          skill.directory.split("/").pop()?.toLowerCase() ||
          skill.directory.toLowerCase();
        return !installedDirs.has(installName);
      });

      if (toInstall.length === 0) {
        toast.info(
          t("skills.batch.allInstalled", "All skills are already installed"),
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
        failedSkills: [],
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

        const skill = toInstall[i];

        // 更新当前安装状态
        setState((prev) => ({
          ...prev,
          current: i,
          currentName: skill.name,
        }));

        try {
          await installMutation.mutateAsync({
            skill,
            currentApp,
          });
          successCount++;
        } catch (error) {
          failCount++;
          failedNames.push(skill.name);
          console.error(`Failed to install ${skill.name}:`, error);
        }

        // 更新进度
        setState((prev) => ({
          ...prev,
          current: i + 1,
          failed: failCount,
          failedSkills: [...failedNames],
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
        toast.info(t("skills.batch.cancelled", "Installation cancelled"), {
          description: t(
            "skills.batch.cancelledDetail",
            "Installed {{success}} of {{total}} skills",
            { success: successCount, total: toInstall.length },
          ),
        });
      } else if (failCount === 0) {
        toast.success(
          t("skills.batch.success", "All skills installed successfully"),
          {
            description: t(
              "skills.batch.successDetail",
              "Successfully installed {{count}} skills",
              { count: successCount },
            ),
          },
        );
      } else {
        toast.warning(
          t("skills.batch.partial", "Installation completed with errors"),
          {
            description: t(
              "skills.batch.partialDetail",
              "Installed {{success}} skills, {{failed}} failed",
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

export default useBatchInstall;
