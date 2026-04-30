export type DeliveryWrapperProfile = {
  appName: string;
  installableName: string;
  executableName: string;
  bundleId: string;
  desktopCaption: string;
  iconHint: string;
  accentColor: string;
  windowTitle: string;
  deliveryMode: "web-first" | "desktop-wrapper";
};

export type DeliveryBrandingAsset = {
  kind: "logo" | "icon" | "splash" | "favicon";
  label: string;
  value: string;
};

export type DeliveryStep = {
  order: number;
  title: string;
  description: string;
};

export type DeliveryPackage = {
  ok: boolean;
  tenantId: string | null;
  clientId: string | null;
  slug: string | null;
  displayName: string | null;
  requestedSlug: string | null;
  source: string;
  wrapper: DeliveryWrapperProfile;
  brandingAssets: DeliveryBrandingAsset[];
  deliverySteps: DeliveryStep[];
  commercialNotes: string[];
  downloadInfo: {
    webUrl: string;
    desktopLabel: string;
    desktopAvailable: boolean;
    desktopStatusText: string;
  };
};