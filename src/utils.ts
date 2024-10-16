import { Filter, FilterNameStringType } from "@aws-sdk/client-secrets-manager";

export function convertFilters(
  filters?: { Key: string; Values: string[] }[]
): Filter[] | undefined {
  if (!filters) return undefined;
  return filters.map((filter) => ({
    Key: filter.Key as FilterNameStringType,
    Values: filter.Values,
  }));
}

export function parseSecretValue<T>(value: string): T {
  try {
    return JSON.parse(value);
  } catch {
    return value as unknown as T;
  }
}
