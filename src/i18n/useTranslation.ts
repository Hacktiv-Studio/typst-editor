import { useAppStore } from "../store/appStore";
import { fr, en, type TranslationKey } from "./translations";

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  const strings = language === "en" ? en : fr;

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const str = strings[key] ?? fr[key] ?? key;
    if (!params) return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ""));
  }

  return { t };
}
