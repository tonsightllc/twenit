import { render } from "@react-email/components";
import * as React from "react";
import { BaseLayout, type BrandingConfig } from "@/emails/components/base-layout";
import { BlockRenderer } from "@/emails/components/block-renderer";
import type { EmailBlock } from "@/emails/components/types";

export type { BrandingConfig } from "@/emails/components/base-layout";
export type { EmailBlock } from "@/emails/components/types";

export async function renderEmailHtml(
  blocks: EmailBlock[],
  branding: BrandingConfig,
  previewText?: string,
): Promise<{ html: string; text: string }> {
  const children = React.createElement(BlockRenderer, {
    blocks,
    accentColor: branding.accentColor,
  });

  const element = React.createElement(BaseLayout, {
    ...branding,
    previewText,
    children,
  });

  const html = await render(element);
  const text = await render(element, { plainText: true });

  return { html, text };
}

export async function renderCustomHtml(
  rawHtml: string,
  branding: BrandingConfig,
  previewText?: string,
): Promise<{ html: string; text: string }> {
  const children = React.createElement("div", {
    dangerouslySetInnerHTML: { __html: rawHtml },
  });

  const element = React.createElement(BaseLayout, {
    ...branding,
    previewText,
    children,
  });

  const html = await render(element);
  const text = await render(element, { plainText: true });

  return { html, text };
}

export function textToBlocks(text: string): EmailBlock[] {
  return text
    .split("\n\n")
    .filter((p) => p.trim())
    .map((p, i) => ({
      id: `p-${i}`,
      type: "paragraph" as const,
      content: p
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>"),
    }));
}

export function extractBranding(emailConfig: Record<string, unknown> | null): BrandingConfig {
  if (!emailConfig) return {};
  return {
    logoUrl: (emailConfig.logo_url as string) || undefined,
    accentColor: (emailConfig.accent_color as string) || "#fbbf24",
    signature: (emailConfig.signature as string) || undefined,
    showFooter: emailConfig.show_footer !== false,
    footerText: (emailConfig.footer_text as string) || undefined,
    senderName: (emailConfig.sender_name as string) || undefined,
  };
}
