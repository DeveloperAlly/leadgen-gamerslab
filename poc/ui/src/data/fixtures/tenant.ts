import type { ThemeKey } from "../../theme/tokens";

/**
 * Tenant configuration. The product is white-label: the tenant name and default
 * theme are data, never hard-coded into layout. Swap this object (and the theme
 * token set) to reskin for another tenant.
 */
export interface TenantConfig {
  name: string;
  defaultTheme: ThemeKey;
}

export const tenant: TenantConfig = {
  name: "Gamers Lab",
  defaultTheme: "gamerslab",
};

/** Usage / credits meter shown at the bottom of the sidebar. */
export const usage = {
  used: 320,
  total: 1000,
};
