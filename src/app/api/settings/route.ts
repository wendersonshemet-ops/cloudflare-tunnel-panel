import { NextRequest } from "next/server";
import { fail, fromUnknownError, ok, statusFromError } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";
import { verifyPassword } from "@/lib/auth";
import { validationError } from "@/lib/errors";
import { appendOperationLog } from "@/lib/operation-logs";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;
  const settings = getSettings();
  return ok({ settings });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (auth) return auth;
  try {
    const body = await request.json();
    const nextSettings = { ...(body ?? {}) };

    // 只有在用户实际填写了新密码时才要求验证当前密码
    const newPassword = String(nextSettings.newPassword || "");
    if (newPassword) {
      const currentPassword = String(nextSettings.currentPassword || "");
      if (!verifyPassword(currentPassword)) {
        throw validationError("当前密码不正确");
      }
      // 写入新密码（覆盖 panelPassword）
      nextSettings.panelPassword = newPassword;
    }
    delete nextSettings.currentPassword;
    delete nextSettings.newPassword;
    const settings = saveSettings(nextSettings);
    appendOperationLog({
      resourceType: "settings",
      action: "save",
      level: "info",
      message: "已保存系统设置",
      details: { ...settings, cloudflareApiToken: settings.cloudflareApiToken ? "***" : "" },
    });
    return ok({ settings });
  } catch (error) {
    appendOperationLog({
      resourceType: "settings",
      action: "save",
      level: "error",
      message: error instanceof Error ? error.message : "保存设置失败",
    });
    return fail(fromUnknownError(error, "保存设置失败"), statusFromError(error, 400));
  }
}