/**
 * UnifiedNavbar - Unified Navigation Bar Component
 *
 * A three-row navigation bar that provides consistent navigation across all pages.
 * Row 1: Core controls (title/back, settings, Proxy, AppSwitcher, +)
 * Row 2: Feature navigation buttons (Skills, Commands, Hooks, Agents, Prompts, MCP)
 * Row 3: Page-specific action buttons
 */

import { useTranslation } from "react-i18next";
import {
  Plus,
  Settings,
  ArrowLeft,
  Bot,
  Book,
  Wrench,
  Server,
  RefreshCw,
  Download,
  Terminal,
  Webhook,
} from "lucide-react";
import type { AppId } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AppSwitcher } from "@/components/AppSwitcher";
import { UpdateBadge } from "@/components/UpdateBadge";
import { ProxyToggle } from "@/components/proxy/ProxyToggle";
import { Button } from "@/components/ui/button";

// View types matching App.tsx
export type View =
  | "providers"
  | "settings"
  | "prompts"
  | "skills"
  | "mcp"
  | "agents"
  | "universal"
  | "commands"
  | "hooks";

// Ref types for page action buttons
export interface PromptPanelRef {
  openAdd: () => void;
}

export interface McpPanelRef {
  openImport: () => void;
  openAdd: () => void;
}

export interface SkillsPageRef {
  refresh: () => void;
  openRepoManager: () => void;
}

export interface PageActionRefs {
  promptPanel?: React.RefObject<PromptPanelRef>;
  mcpPanel?: React.RefObject<McpPanelRef>;
  skillsPage?: React.RefObject<SkillsPageRef>;
}

export interface UnifiedNavbarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  activeApp: AppId;
  onAppChange: (app: AppId) => void;
  pageActionRefs?: PageActionRefs;
  onAddProvider: () => void;
}

// Feature button configuration
interface FeatureButton {
  view: View;
  icon: React.ReactNode;
  labelKey: string;
  highlightViews: View[]; // Views that should highlight this button
}

const FEATURE_BUTTONS: FeatureButton[] = [
  {
    view: "skills",
    icon: <Wrench className="w-4 h-4" />,
    labelKey: "navbar.skills",
    highlightViews: ["skills"],
  },
  {
    view: "commands",
    icon: <Terminal className="w-4 h-4" />,
    labelKey: "navbar.commands",
    highlightViews: ["commands"],
  },
  {
    view: "hooks",
    icon: <Webhook className="w-4 h-4" />,
    labelKey: "navbar.hooks",
    highlightViews: ["hooks"],
  },
  {
    view: "agents",
    icon: <Bot className="w-4 h-4" />,
    labelKey: "navbar.agents",
    highlightViews: ["agents"],
  },
  {
    view: "prompts",
    icon: <Book className="w-4 h-4" />,
    labelKey: "navbar.prompts",
    highlightViews: ["prompts"],
  },
  {
    view: "mcp",
    icon: <Server className="w-4 h-4" />,
    labelKey: "navbar.mcp",
    highlightViews: ["mcp"],
  },
];

// Back navigation logic
const getBackTarget = (_view: View): View => {
  return "providers";
};

// Page title mapping
const getPageTitle = (
  view: View,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const titles: Partial<Record<View, string>> = {
    settings: t("settings.title"),
    prompts: t("prompts.title", { appName: "" }).trim(),
    skills: t("skills.title"),
    mcp: t("mcp.unifiedPanel.title"),
    agents: t("agents.title"),
    commands: t("commands.title"),
    hooks: t("hooks.title"),
    universal: t("universalProvider.title"),
  };
  return titles[view] || "";
};

export function UnifiedNavbar({
  currentView,
  onViewChange,
  activeApp,
  onAppChange,
  pageActionRefs,
  onAddProvider,
}: UnifiedNavbarProps) {
  const { t } = useTranslation();

  const isHomePage = currentView === "providers";
  const addActionButtonClass =
    "bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 dark:shadow-orange-500/40 rounded-full w-8 h-8";

  // Determine which feature button should be highlighted
  const getHighlightedFeature = (): View | null => {
    for (const btn of FEATURE_BUTTONS) {
      if (btn.highlightViews.includes(currentView)) {
        return btn.view;
      }
    }
    return null;
  };

  const highlightedFeature = getHighlightedFeature();

  // Handle back navigation
  const handleBack = () => {
    const target = getBackTarget(currentView);
    onViewChange(target);
  };

  // Render Row 1: Core controls
  const renderRow1 = () => (
    <div
      className="flex items-center justify-center h-8 px-6"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between w-full max-w-2xl">
        {/* Left side: Title area */}
        <div className="flex items-center gap-2">
          {isHomePage ? (
            <>
              <a
                href="https://github.com/farion1231/cc-switch"
                target="_blank"
                rel="noreferrer"
                className="text-base font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                CC Switch
              </a>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onViewChange("settings")}
                title={t("common.settings")}
                className="hover:bg-black/5 dark:hover:bg-white/5 h-7 w-7"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
              <UpdateBadge onClick={() => onViewChange("settings")} />
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleBack}
                className="rounded-lg h-7 w-7"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </Button>
              <h1 className="text-sm font-medium ml-2">
                {getPageTitle(currentView, t)}
              </h1>
            </>
          )}
        </div>

        {/* Right side: Controls */}
        <div className="flex items-center gap-2">
          {/* Settings button for sub-pages */}
          {!isHomePage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewChange("settings")}
              title={t("common.settings")}
              className="hover:bg-black/5 dark:hover:bg-white/5 h-7 w-7"
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          )}

          <ProxyToggle activeApp={activeApp} />

          <AppSwitcher activeApp={activeApp} onSwitch={onAppChange} />

          <Button
            onClick={onAddProvider}
            size="icon"
            className={`ml-2 ${addActionButtonClass}`}
            title={t("header.addProvider")}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Render Row 2: Feature navigation buttons
  const renderRow2 = () => (
    <div
      className="flex items-center justify-center h-8 px-6"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-1 p-1 bg-muted rounded-xl">
        {FEATURE_BUTTONS.map((btn) => {
          const isHighlighted = highlightedFeature === btn.view;
          return (
            <Button
              key={btn.view}
              variant="ghost"
              size="sm"
              onClick={() => onViewChange(btn.view)}
              className={cn(
                "transition-all duration-200 ease-in-out px-3 h-7",
                isHighlighted
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
              )}
              title={t(btn.labelKey)}
            >
              {btn.icon}
              <span className="hidden md:inline ml-2 text-sm font-medium">
                {t(btn.labelKey)}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );

  // Render Row 3: Page-specific action buttons
  const renderRow3 = () => {
    const renderActionButtons = () => {
      switch (currentView) {
        case "prompts":
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => pageActionRefs?.promptPanel?.current?.openAdd()}
              className="h-7"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("prompts.add")}
            </Button>
          );

        case "mcp":
          return (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pageActionRefs?.mcpPanel?.current?.openImport()}
                className="h-7"
              >
                <Download className="w-4 h-4 mr-2" />
                {t("mcp.importExisting")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pageActionRefs?.mcpPanel?.current?.openAdd()}
                className="h-7"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("mcp.addMcp")}
              </Button>
            </>
          );

        case "skills":
          return (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pageActionRefs?.skillsPage?.current?.refresh()}
                className="h-7"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("skills.refresh")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  pageActionRefs?.skillsPage?.current?.openRepoManager()
                }
                className="h-7"
              >
                <Settings className="w-4 h-4 mr-2" />
                {t("skills.repoManager")}
              </Button>
            </>
          );

        default:
          // Empty placeholder for pages without actions
          return null;
      }
    };

    const actionButtons = renderActionButtons();

    return (
      <div
        className="flex items-center justify-center h-8 px-6"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">{actionButtons}</div>
      </div>
    );
  };

  return (
    <header
      className="fixed z-50 w-full transition-all duration-300 bg-background/80 backdrop-blur-md"
      data-tauri-drag-region
      style={
        {
          WebkitAppRegion: "drag",
          top: 28, // Below drag bar
          height: 96, // 3 rows * 32px
        } as React.CSSProperties
      }
    >
      <div
        className="mx-auto max-w-[56rem] h-full flex flex-col justify-center gap-1 py-2"
        data-tauri-drag-region
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        {renderRow1()}
        {renderRow2()}
        {renderRow3()}
      </div>
    </header>
  );
}

export default UnifiedNavbar;
