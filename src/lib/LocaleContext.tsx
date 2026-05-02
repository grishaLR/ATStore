import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { locale as localeApi } from "#/integrations/tanstack-query/api-locale.functions";
import { i18next } from "#/i18n";

import { DEFAULT_LOCALE, type Locale } from "./locale";

export interface LocaleContextValue {
  /** The user's chosen locale. */
  locale: Locale;
  /** Persist a new locale (cookie-backed via the `setLocalePreference` server fn). */
  setLocale: (next: Locale) => void;
  /** Whether a setLocale mutation is currently in flight. */
  isPending: boolean;
}

/**
 * Read + update the locale preference.
 *
 * Source of truth lives in the `localePreference` query (cookie-backed via
 * the `setLocalePreference` server fn). The mutation writes through, patches
 * the cache, and switches the live `i18next` instance so all consumers
 * re-render together.
 *
 * Mirrors `useTheme` — same broadcast semantics via TanStack Query, no
 * Provider needed.
 */
export function useLocale(): LocaleContextValue {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...localeApi.getLocalePreferenceQueryOptions,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const current = data?.locale ?? DEFAULT_LOCALE;

  const setMutation = useMutation({
    mutationFn: (next: Locale) =>
      localeApi.setLocalePreference({ data: { locale: next } }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: localeApi.getLocalePreferenceQueryOptions.queryKey,
      });
      const previous = queryClient.getQueryData(
        localeApi.getLocalePreferenceQueryOptions.queryKey,
      );
      queryClient.setQueryData(
        localeApi.getLocalePreferenceQueryOptions.queryKey,
        { locale: next },
      );
      void i18next.changeLanguage(next);
      return { previous };
    },
    onError: (_error, _next, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          localeApi.getLocalePreferenceQueryOptions.queryKey,
          ctx.previous,
        );
        void i18next.changeLanguage(ctx.previous.locale);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        localeApi.getLocalePreferenceQueryOptions.queryKey,
        result,
      );
    },
  });

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === current) return;
      setMutation.mutate(next);
    },
    [current, setMutation],
  );

  return {
    locale: current,
    setLocale,
    isPending: setMutation.isPending,
  };
}
