import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface BrandingConfig {
  logoUrl?: string;
  accentColor?: string;
  signature?: string;
  showFooter?: boolean;
  footerText?: string;
  senderName?: string;
}

interface BaseLayoutProps extends BrandingConfig {
  previewText?: string;
  children: React.ReactNode;
}

export function BaseLayout({
  logoUrl,
  accentColor = "#fbbf24",
  signature,
  showFooter = true,
  footerText,
  senderName,
  previewText,
  children,
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {logoUrl && (
            <Section style={logoSectionStyle}>
              <Img
                src={logoUrl}
                alt={senderName ?? "Logo"}
                height={48}
                style={logoImgStyle}
              />
            </Section>
          )}

          {!logoUrl && senderName && (
            <Text style={{ ...senderNameStyle, color: accentColor }}>
              {senderName}
            </Text>
          )}

          <Section>{children}</Section>

          {signature && (
            <>
              <Hr style={hrStyle} />
              <Text style={signatureStyle}>{signature}</Text>
            </>
          )}

          {showFooter && footerText && (
            <Section style={footerSectionStyle}>
              <Text style={footerTextStyle}>{footerText}</Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: "40px 0",
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 32px",
  maxWidth: "560px",
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
};

const logoSectionStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "24px",
};

const logoImgStyle: React.CSSProperties = {
  margin: "0 auto",
};

const senderNameStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  textAlign: "center",
  marginBottom: "24px",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "28px 0 16px",
};

const signatureStyle: React.CSSProperties = {
  color: "#71717a",
  fontSize: "14px",
  lineHeight: "1.5",
  whiteSpace: "pre-wrap",
};

const footerSectionStyle: React.CSSProperties = {
  marginTop: "24px",
  paddingTop: "16px",
  borderTop: "1px solid #e4e4e7",
};

const footerTextStyle: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: "12px",
  lineHeight: "1.5",
  textAlign: "center",
};
