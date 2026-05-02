/**
 * Locale preference. Mirrors the theme-preference pattern: a cookie-backed
 * server function whose result is prefilled into the query cache during
 * `beforeLoad`, so SSR can render `<html lang>` and translated strings on
 * first paint without a hydration flash.
 *
 * Falls back to `Accept-Language` when the cookie isn't set so first-time
 * visitors land in their preferred language when we support it.
 */
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALES,
  isLocale,
  matchAcceptLanguage,
  type Locale,
} from "#/lib/locale";

const getLocalePreference = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locale: Locale }> => {
    const cookieValue = getCookie(LOCALE_COOKIE);
    if (isLocale(cookieValue)) return { locale: cookieValue };

    const request = getRequest();
    const acceptLanguage = request.headers.get("accept-language");
    return { locale: matchAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE };
  },
);

const getLocalePreferenceQueryOptions = queryOptions({
  queryKey: ["localePreference"] as const,
  queryFn: () => getLocalePreference(),
  staleTime: Number.POSITIVE_INFINITY,
});

const setLocalePreference = createServerFn({ method: "POST" })
  .inputValidator(z.object({ locale: z.enum(LOCALES) }))
  .handler(async ({ data }): Promise<{ locale: Locale }> => {
    setCookie(LOCALE_COOKIE, data.locale, {
      path: "/",
      sameSite: "lax",
      maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    });
    return { locale: data.locale };
  });

export const locale = {
  getLocalePreference,
  getLocalePreferenceQueryOptions,
  setLocalePreference,
};
