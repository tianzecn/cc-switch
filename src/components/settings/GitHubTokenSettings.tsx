import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  Key,
  AlertCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import {
  useGitHubTokenStatus,
  useValidateGitHubToken,
  useSaveGitHubToken,
} from "@/hooks/useResourceUpdates";
import { toast } from "sonner";

/**
 * GitHub Token 配置组件
 *
 * 用于配置 GitHub Personal Access Token，提高 API 速率限制
 */
export function GitHubTokenSettings() {
  const { t } = useTranslation();
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    remaining?: number;
    limit?: number;
    resetAt?: number;
  } | null>(null);

  // Hooks
  const {
    data: tokenStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useGitHubTokenStatus();
  const validateMutation = useValidateGitHubToken();
  const saveMutation = useSaveGitHubToken();

  // 是否已配置 token
  const hasToken = !!tokenStatus;

  // 验证 token
  const handleValidate = useCallback(async () => {
    if (!tokenInput.trim()) {
      toast.error(t("settings.github.tokenEmpty", "Please enter a token"));
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(tokenInput.trim());
      setValidationResult({
        valid: true,
        remaining: result.remaining,
        limit: result.limit,
        resetAt: result.resetAt,
      });
      toast.success(t("settings.github.tokenValid", "Token is valid!"));
    } catch (error) {
      setValidationResult({ valid: false });
      toast.error(t("settings.github.tokenInvalid", "Token is invalid"));
    }
  }, [tokenInput, validateMutation, t]);

  // 保存 token
  const handleSave = useCallback(async () => {
    if (!tokenInput.trim()) {
      toast.error(t("settings.github.tokenEmpty", "Please enter a token"));
      return;
    }

    try {
      await saveMutation.mutateAsync(tokenInput.trim());
      setTokenInput("");
      setValidationResult(null);
      await refetchStatus();
      toast.success(
        t("settings.github.tokenSaved", "Token saved successfully!"),
      );
    } catch (error) {
      toast.error(t("settings.github.saveFailed", "Failed to save token"));
    }
  }, [tokenInput, saveMutation, refetchStatus, t]);

  // 删除 token
  const handleDelete = useCallback(async () => {
    try {
      await saveMutation.mutateAsync(undefined);
      setTokenInput("");
      setValidationResult(null);
      await refetchStatus();
      toast.success(t("settings.github.tokenDeleted", "Token deleted"));
    } catch (error) {
      toast.error(t("settings.github.deleteFailed", "Failed to delete token"));
    }
  }, [saveMutation, refetchStatus, t]);

  // 清空输入和验证结果
  useEffect(() => {
    if (!tokenInput) {
      setValidationResult(null);
    }
  }, [tokenInput]);

  // 格式化重置时间
  const formatResetTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      {/* 状态显示 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {t("settings.github.status", "Status")}
          </span>
        </div>
        {isLoadingStatus ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasToken ? (
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            {t("settings.github.configured", "Configured")}
            <span className="text-xs opacity-70">({tokenStatus})</span>
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <X className="h-3 w-3" />
            {t("settings.github.notConfigured", "Not configured")}
          </Badge>
        )}
      </div>

      {/* 未配置时的说明 */}
      {!hasToken && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-600 dark:text-yellow-400">
              <p className="font-medium">
                {t(
                  "settings.github.rateLimitWarning",
                  "API Rate Limit Warning",
                )}
              </p>
              <p className="mt-1 opacity-90">
                {t(
                  "settings.github.rateLimitDescription",
                  "Without a token, GitHub API is limited to 60 requests/hour. With a token, you get 5000 requests/hour.",
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Token 输入区域 */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showToken ? "text" : "password"}
              placeholder={
                hasToken
                  ? t(
                      "settings.github.enterNewToken",
                      "Enter new token to replace...",
                    )
                  : t("settings.github.enterToken", "ghp_xxxxxxxxxxxx")
              }
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={!tokenInput.trim() || validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            {t("settings.github.validate", "Validate")}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!tokenInput.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            {t("common.save", "Save")}
          </Button>

          {hasToken && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={saveMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("common.delete", "Delete")}
            </Button>
          )}
        </div>
      </div>

      {/* 验证结果 */}
      {validationResult && (
        <div
          className={`p-3 rounded-lg border ${
            validationResult.valid
              ? "bg-green-500/10 border-green-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
        >
          {validationResult.valid ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("settings.github.tokenValid", "Token is valid!")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t("settings.github.rateLimit", "Rate limit")}:{" "}
                {validationResult.remaining} / {validationResult.limit}
                {validationResult.resetAt && (
                  <span className="ml-2">
                    ({t("settings.github.resetsAt", "Resets at")}{" "}
                    {formatResetTime(validationResult.resetAt)})
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t("settings.github.tokenInvalid", "Token is invalid")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 帮助链接 */}
      <div className="pt-2">
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {t(
            "settings.github.createToken",
            "Create a Personal Access Token on GitHub",
          )}
        </a>
      </div>
    </div>
  );
}

export default GitHubTokenSettings;
