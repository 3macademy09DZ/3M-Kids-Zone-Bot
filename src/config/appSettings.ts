import type { EnvConfig } from "./env";
import { isChannelConfigured } from "./env";
import {
  getSettingOverride,
  SETTINGS_KEYS,
} from "../database/settings";

export interface AppSettings {
  channelId: string | undefined;
  channelEnabled: boolean;
  contactUsername: string | undefined;
  contactEnabled: boolean;
  ccpAccountInfo: string | undefined;
  baridimobRip: string | undefined;
  paymentAccountName: string | undefined;
  redotpayPaymentInfo: string | undefined;
  ccpEnabled: boolean;
  redotpayEnabled: boolean;
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pickString(
  override: string | undefined,
  envFallback: string | undefined
): string | undefined {
  if (override !== undefined) {
    return cleanOptional(override);
  }
  return cleanOptional(envFallback);
}

function pickFlag(override: string | undefined, fallback: boolean): boolean {
  if (override === "0") {
    return false;
  }
  if (override === "1") {
    return true;
  }
  return fallback;
}

export function resolveAppSettings(env: EnvConfig): AppSettings {
  const channelId = pickString(
    getSettingOverride(SETTINGS_KEYS.CHANNEL_ID),
    env.channelId
  );
  const contactUsername = pickString(
    getSettingOverride(SETTINGS_KEYS.CONTACT_USERNAME),
    env.contactUsername
  );

  return {
    channelId,
    channelEnabled: pickFlag(
      getSettingOverride(SETTINGS_KEYS.CHANNEL_ENABLED),
      Boolean(channelId)
    ),
    contactUsername,
    contactEnabled: pickFlag(
      getSettingOverride(SETTINGS_KEYS.CONTACT_ENABLED),
      Boolean(contactUsername)
    ),
    ccpAccountInfo: pickString(
      getSettingOverride(SETTINGS_KEYS.CCP_ACCOUNT_INFO),
      env.ccpAccountInfo
    ),
    baridimobRip: pickString(
      getSettingOverride(SETTINGS_KEYS.BARIDIMOB_RIP),
      env.baridimobRip
    ),
    paymentAccountName: pickString(
      getSettingOverride(SETTINGS_KEYS.PAYMENT_ACCOUNT_NAME),
      env.paymentAccountName
    ),
    redotpayPaymentInfo: pickString(
      getSettingOverride(SETTINGS_KEYS.REDOTPAY_PAYMENT_INFO),
      env.redotpayPaymentInfo
    ),
    ccpEnabled: pickFlag(getSettingOverride(SETTINGS_KEYS.CCP_ENABLED), true),
    redotpayEnabled: pickFlag(
      getSettingOverride(SETTINGS_KEYS.REDOTPAY_ENABLED),
      true
    ),
  };
}

export function effectiveChannelId(settings: AppSettings): string | undefined {
  return settings.channelEnabled && isChannelConfigured(settings.channelId)
    ? settings.channelId
    : undefined;
}

export function isChannelActive(settings: AppSettings): boolean {
  return Boolean(effectiveChannelId(settings));
}

export function isContactActive(settings: AppSettings): boolean {
  return settings.contactEnabled && Boolean(settings.contactUsername);
}

export function paymentMethodOptions(settings: AppSettings): {
  ccp: boolean;
  redotpay: boolean;
} {
  return {
    ccp: settings.ccpEnabled,
    redotpay: settings.redotpayEnabled,
  };
}
