/**
 * 应用程序自动升级 Hook
 *
 * 提供完整的应用更新功能：
 * - 启动时自动检测
 * - 定时检测（每 6 小时）
 * - 下载进度追踪
 * - 重试机制
 * - 跳过版本功能
 * - 强制更新检测
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appUpdaterApi, type UpdaterConfigInfo } from "@/lib/api";
import {
  checkForUpdate,
  getCurrentVersion,
  relaunchApp,
  type UpdateHandle,
  type UpdateInfo,
  type UpdateProgressEvent,
} from "@/lib/updater";

/**
 * 更新器阶段
 */
export type UpdaterPhase =
  | "idle" // 空闲状态
  | "checking" // 正在检查更新
  | "available" // 有可用更新
  | "downloading" // 正在下载
  | "downloaded" // 下载完成
  | "installing" // 正在安装
  | "restarting" // 正在重启
  | "upToDate" // 已是最新版本
  | "error"; // 错误状态

/**
 * 下载进度信息
 */
export interface DownloadProgress {
  downloaded: number; // 已下载字节数
  total: number; // 总字节数
  percentage: number; // 百分比 (0-100)
  speed: number; // 下载速度 (bytes/s)
}

/**
 * 扩展的更新信息（包含强制更新标记）
 */
export interface ExtendedUpdateInfo extends UpdateInfo {
  mandatory?: boolean; // 是否强制更新
}

/**
 * Hook 返回值
 */
export interface UseAppUpdaterResult {
  // 状态
  phase: UpdaterPhase;
  updateInfo: ExtendedUpdateInfo | null;
  progress: DownloadProgress | null;
  error: Error | null;
  config: UpdaterConfigInfo | null;

  // 版本信息
  currentVersion: string;

  // 操作
  checkUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  skipVersion: () => Promise<void>;
  setProxy: (proxy: string | null) => Promise<void>;
  dismissUpdate: () => void;
  retryLastAction: () => Promise<void>;

  // 加载状态
  isConfigLoading: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: UpdaterConfigInfo = {
  proxy: null,
  auto_check_enabled: true,
  check_interval_hours: 6,
  last_check_at: null,
};

/**
 * 最大重试次数
 */
const MAX_RETRY_COUNT = 3;

/**
 * 应用程序自动升级 Hook
 */
export function useAppUpdater(): UseAppUpdaterResult {
  const queryClient = useQueryClient();

  // 状态
  const [phase, setPhase] = useState<UpdaterPhase>("idle");
  const [updateInfo, setUpdateInfo] = useState<ExtendedUpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  // Refs
  const updateHandleRef = useRef<UpdateHandle | null>(null);
  const retryCountRef = useRef<number>(0);
  const lastActionRef = useRef<"check" | "download" | "install" | null>(null);
  const progressStartTimeRef = useRef<number>(0);
  const downloadedBytesRef = useRef<number>(0);

  // 配置查询
  const configQuery = useQuery({
    queryKey: ["appUpdaterConfig"],
    queryFn: () => appUpdaterApi.getConfig(),
    staleTime: 5 * 60 * 1000, // 5 分钟
    refetchOnWindowFocus: false,
  });

  const config = configQuery.data ?? DEFAULT_CONFIG;

  // 获取当前版本
  useEffect(() => {
    getCurrentVersion().then(setCurrentVersion).catch(console.error);
  }, []);

  // 设置代理 Mutation
  const setProxyMutation = useMutation({
    mutationFn: (proxy: string | null) => appUpdaterApi.setProxy(proxy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appUpdaterConfig"] });
    },
  });

  // 跳过版本 Mutation
  const skipVersionMutation = useMutation({
    mutationFn: (version: string) => appUpdaterApi.skipVersion(version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appUpdaterConfig"] });
    },
  });

  /**
   * 重置状态
   */
  const resetState = useCallback(() => {
    setPhase("idle");
    setUpdateInfo(null);
    setProgress(null);
    setError(null);
    updateHandleRef.current = null;
    retryCountRef.current = 0;
    lastActionRef.current = null;
  }, []);

  /**
   * 检查更新
   */
  const checkUpdate = useCallback(async () => {
    try {
      lastActionRef.current = "check";
      setPhase("checking");
      setError(null);

      const result = await checkForUpdate({ timeout: 30000 });

      if (result.status === "up-to-date") {
        setPhase("upToDate");
        retryCountRef.current = 0;
        return;
      }

      // 检查是否被跳过
      const isSkipped = await appUpdaterApi.isVersionSkipped(
        result.info.availableVersion,
      );
      if (isSkipped) {
        setPhase("upToDate");
        return;
      }

      // 更新上次检测时间
      await appUpdaterApi.updateLastCheckTime();

      // 解析更新日志中的 mandatory 标记
      // 格式：在 notes 中查找 [MANDATORY] 或从 latest.json 的 mandatory 字段
      const isMandatory = result.info.notes?.includes("[MANDATORY]") ?? false;

      setUpdateInfo({
        ...result.info,
        mandatory: isMandatory,
      });
      updateHandleRef.current = result.update;
      setPhase("available");
      retryCountRef.current = 0;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setPhase("error");

      // 自动重试
      if (retryCountRef.current < MAX_RETRY_COUNT) {
        retryCountRef.current++;
        console.warn(
          `[useAppUpdater] Check failed, retry ${retryCountRef.current}/${MAX_RETRY_COUNT}`,
        );
        setTimeout(() => checkUpdate(), 3000);
      }
    }
  }, []);

  /**
   * 下载更新
   */
  const downloadUpdate = useCallback(async () => {
    const handle = updateHandleRef.current;
    if (!handle) {
      setError(new Error("No update available"));
      setPhase("error");
      return;
    }

    try {
      lastActionRef.current = "download";
      setPhase("downloading");
      setError(null);
      setProgress({ downloaded: 0, total: 0, percentage: 0, speed: 0 });

      progressStartTimeRef.current = Date.now();
      downloadedBytesRef.current = 0;

      await handle.downloadAndInstall((event: UpdateProgressEvent) => {
        if (event.event === "Started") {
          const total = event.total ?? 0;
          setProgress({
            downloaded: 0,
            total,
            percentage: 0,
            speed: 0,
          });
        } else if (event.event === "Progress") {
          const chunkLength = event.downloaded ?? 0;
          downloadedBytesRef.current += chunkLength;

          setProgress((prev) => {
            if (!prev) return prev;

            const downloaded = downloadedBytesRef.current;
            const total = prev.total;
            const percentage =
              total > 0 ? Math.round((downloaded / total) * 100) : 0;

            // 计算下载速度
            const elapsedMs = Date.now() - progressStartTimeRef.current;
            const speed =
              elapsedMs > 0 ? Math.round((downloaded / elapsedMs) * 1000) : 0;

            return {
              downloaded,
              total,
              percentage,
              speed,
            };
          });
        } else if (event.event === "Finished") {
          setProgress((prev) =>
            prev
              ? {
                  ...prev,
                  percentage: 100,
                }
              : prev,
          );
          // downloadAndInstall 完成后，检查是否需要手动安装（macOS 特定问题）
          // Tauri 的 downloadAndInstall 可能无法自动移动更新包到 /Applications
        }
      });

      // 检查是否有待安装的 macOS 更新（Tauri downloadAndInstall 可能静默失败）
      const pendingVersion = await appUpdaterApi.checkPendingMacOSUpdate();
      if (pendingVersion) {
        console.warn(
          "[useAppUpdater] Detected pending macOS update, attempting manual install...",
        );
        const installResult = await appUpdaterApi.tryInstallMacOSUpdate();
        if (!installResult.success) {
          console.error(
            "[useAppUpdater] macOS manual install failed:",
            installResult.error,
          );
          // 即使手动安装失败，也继续流程，让用户可以尝试重启
        } else {
          console.info(
            "[useAppUpdater] macOS manual install successful:",
            installResult.installed_version,
          );
        }
      }

      setPhase("downloaded");
      retryCountRef.current = 0;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setPhase("error");

      // 自动重试
      if (retryCountRef.current < MAX_RETRY_COUNT) {
        retryCountRef.current++;
        console.warn(
          `[useAppUpdater] Download failed, retry ${retryCountRef.current}/${MAX_RETRY_COUNT}`,
        );
        setTimeout(() => downloadUpdate(), 3000);
      }
    }
  }, []);

  /**
   * 安装更新（重启应用）
   */
  const installUpdate = useCallback(async () => {
    try {
      lastActionRef.current = "install";
      setPhase("installing");
      setError(null);

      // 等待一小段时间确保用户能看到状态变化
      await new Promise((resolve) => setTimeout(resolve, 500));

      setPhase("restarting");
      await relaunchApp();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setPhase("error");
    }
  }, []);

  /**
   * 跳过当前版本
   */
  const skipVersion = useCallback(async () => {
    if (!updateInfo) return;

    try {
      await skipVersionMutation.mutateAsync(updateInfo.availableVersion);
      resetState();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    }
  }, [updateInfo, skipVersionMutation, resetState]);

  /**
   * 设置代理
   */
  const setProxy = useCallback(
    async (proxy: string | null) => {
      try {
        await setProxyMutation.mutateAsync(proxy);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
      }
    },
    [setProxyMutation],
  );

  /**
   * 关闭更新提示
   */
  const dismissUpdate = useCallback(() => {
    resetState();
  }, [resetState]);

  /**
   * 重试上次失败的操作
   */
  const retryLastAction = useCallback(async () => {
    retryCountRef.current = 0;
    setError(null);

    switch (lastActionRef.current) {
      case "check":
        await checkUpdate();
        break;
      case "download":
        await downloadUpdate();
        break;
      case "install":
        await installUpdate();
        break;
      default:
        await checkUpdate();
    }
  }, [checkUpdate, downloadUpdate, installUpdate]);

  // 启动时自动检测
  useEffect(() => {
    const shouldCheck = async () => {
      try {
        const shouldAutoCheck = await appUpdaterApi.shouldAutoCheck();
        if (shouldAutoCheck) {
          // 延迟 3 秒再检测，避免影响应用启动
          setTimeout(() => checkUpdate(), 3000);
        }
      } catch (err) {
        console.warn(
          "[useAppUpdater] Failed to check auto-update status:",
          err,
        );
      }
    };

    shouldCheck();
  }, [checkUpdate]);

  // 定时检测
  useEffect(() => {
    if (!config.auto_check_enabled) return;

    const intervalMs = config.check_interval_hours * 60 * 60 * 1000;
    const interval = setInterval(() => {
      // 只在空闲状态下检测
      if (phase === "idle" || phase === "upToDate") {
        checkUpdate();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [
    config.auto_check_enabled,
    config.check_interval_hours,
    phase,
    checkUpdate,
  ]);

  return useMemo(
    () => ({
      phase,
      updateInfo,
      progress,
      error,
      config,
      currentVersion,
      checkUpdate,
      downloadUpdate,
      installUpdate,
      skipVersion,
      setProxy,
      dismissUpdate,
      retryLastAction,
      isConfigLoading: configQuery.isLoading,
    }),
    [
      phase,
      updateInfo,
      progress,
      error,
      config,
      currentVersion,
      checkUpdate,
      downloadUpdate,
      installUpdate,
      skipVersion,
      setProxy,
      dismissUpdate,
      retryLastAction,
      configQuery.isLoading,
    ],
  );
}
