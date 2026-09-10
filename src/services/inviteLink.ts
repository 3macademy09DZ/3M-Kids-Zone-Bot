import type { Api } from "grammy";
import type { EnvConfig } from "../config/env";
import { isChannelConfigured } from "../config/env";
import { effectiveChannelId, resolveAppSettings } from "../config/appSettings";
import { logger } from "../utils/logger";

/**
 * Configuration for channel invite links (one customer per link).
 * Matches the intended Telegram channel setup for 3M Kids Zone.
 */
export interface InviteLinkConfig {
  /** Private channel — invite links grant access to a non-public channel */
  privateChannel: true;
  /** Each link is intended for a single customer */
  oneCustomerPerLink: true;
  /** Maximum number of times the link can be used */
  memberLimit: 1;
  /** No expiration by default (null = unlimited) */
  expireDate: null;
  /** Require admin approval for join requests when the channel uses that mode */
  createsJoinRequest: boolean;
}

export const DEFAULT_INVITE_LINK_CONFIG: InviteLinkConfig = {
  privateChannel: true,
  oneCustomerPerLink: true,
  memberLimit: 1,
  expireDate: null,
  createsJoinRequest: true,
};

export interface GenerateInviteLinkResult {
  success: boolean;
  inviteLink?: string;
  inviteLinkName?: string;
  error?: string;
}

export class InviteLinkService {
  constructor(
    private readonly api: Api,
    private readonly env: EnvConfig
  ) {}

  private resolvedChannelId(): string | undefined {
    return effectiveChannelId(resolveAppSettings(this.env));
  }

  isReady(): boolean {
    return isChannelConfigured(this.resolvedChannelId());
  }

  getStatusMessage(): string {
    if (!this.isReady()) {
      return (
        "⚠️ نظام روابط الدعوة غير مفعّل حالياً.\n\n" +
        "يُرجى ضبط القناة من قسم الإعدادات وإضافة البوت كمسؤول في القناة الخاصة " +
        "«3M Kids Zone» مع صلاحية «إنشاء روابط دعوة»."
      );
    }
    return "✅ نظام روابط الدعوة جاهز للتكوين.";
  }

  /**
   * Generates a unique invitation link for a customer order.
   *
   * Requires:
   * - CHANNEL_ID configured in environment
   * - Bot added as admin to the private channel with "Invite users via link" permission
   *
   * Link settings: member_limit=1, no expiration, optional join request.
   */
  async generateInviteLink(
    linkName: string,
    config: InviteLinkConfig = DEFAULT_INVITE_LINK_CONFIG
  ): Promise<GenerateInviteLinkResult> {
    const channelId = this.resolvedChannelId();
    if (!this.isReady() || !channelId) {
      logger.warn("Invite link generation skipped: channel is not configured");
      return {
        success: false,
        error: "Channel is not configured",
      };
    }

    try {
      const inviteLink = await this.api.createChatInviteLink(channelId, {
        name: linkName,
        member_limit: config.memberLimit,
        expire_date: config.expireDate ?? undefined,
        creates_join_request: config.createsJoinRequest,
      });

      logger.info(`Invite link created: ${linkName}`);

      return {
        success: true,
        inviteLink: inviteLink.invite_link,
        inviteLinkName: linkName,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to create invite link", message);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Revokes an existing invitation link (for future use).
   */
  async revokeInviteLink(inviteLink: string): Promise<boolean> {
    const channelId = this.resolvedChannelId();
    if (!this.isReady() || !channelId) {
      logger.warn("Invite link revocation skipped: channel is not configured");
      return false;
    }

    try {
      await this.api.revokeChatInviteLink(channelId, inviteLink);
      logger.info("Invite link revoked");
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to revoke invite link", message);
      return false;
    }
  }
}
