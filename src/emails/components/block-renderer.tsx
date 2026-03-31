import {
  Button,
  Heading,
  Hr,
  Img,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { EmailBlock } from "./types";

interface BlockRendererProps {
  blocks: EmailBlock[];
  accentColor?: string;
}

export function BlockRenderer({ blocks, accentColor = "#fbbf24" }: BlockRendererProps) {
  return (
    <>
      {blocks.map((block) => (
        <EmailBlockComponent key={block.id} block={block} accentColor={accentColor} />
      ))}
    </>
  );
}

function EmailBlockComponent({
  block,
  accentColor,
}: {
  block: EmailBlock;
  accentColor: string;
}) {
  switch (block.type) {
    case "heading": {
      const level = block.attrs?.level ?? 2;
      const tag = `h${level}` as "h1" | "h2" | "h3";
      return (
        <Heading as={tag} style={{ ...headingStyles[level], color: "#1a1a1a" }}>
          {block.content && (
            <span dangerouslySetInnerHTML={{ __html: block.content }} />
          )}
        </Heading>
      );
    }

    case "paragraph":
      return (
        <Text style={paragraphStyle}>
          {block.content ? (
            <span dangerouslySetInnerHTML={{ __html: block.content }} />
          ) : null}
        </Text>
      );

    case "callout": {
      const variant = block.attrs?.variant ?? "info";
      const variantStyle = calloutVariants[variant];
      return (
        <Section style={{ ...calloutBaseStyle, ...variantStyle }}>
          <Text style={{ ...calloutTextStyle, color: variantStyle.color }}>
            {block.content ? (
              <span dangerouslySetInnerHTML={{ __html: block.content }} />
            ) : null}
          </Text>
        </Section>
      );
    }

    case "button":
      return (
        <Section style={buttonSectionStyle}>
          <Button
            href={block.attrs?.href ?? "#"}
            style={{ ...buttonStyle, backgroundColor: accentColor }}
          >
            {block.attrs?.label ?? block.content ?? "Click aquí"}
          </Button>
        </Section>
      );

    case "image":
      return (
        <Section style={imageSectionStyle}>
          <Img
            src={block.attrs?.src ?? ""}
            alt={block.attrs?.alt ?? ""}
            style={imageStyle}
          />
        </Section>
      );

    case "separator":
      return <Hr style={separatorStyle} />;

    default:
      return null;
  }
}

const headingStyles: Record<number, React.CSSProperties> = {
  1: { fontSize: "24px", fontWeight: 700, lineHeight: "1.3", marginBottom: "16px" },
  2: { fontSize: "20px", fontWeight: 600, lineHeight: "1.3", marginBottom: "14px" },
  3: { fontSize: "16px", fontWeight: 600, lineHeight: "1.4", marginBottom: "12px" },
};

const paragraphStyle: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: "15px",
  lineHeight: "1.6",
  marginBottom: "16px",
};

const calloutBaseStyle: React.CSSProperties = {
  borderRadius: "6px",
  padding: "16px 20px",
  marginBottom: "20px",
  borderLeft: "4px solid",
};

const calloutVariants: Record<string, React.CSSProperties> = {
  info: {
    backgroundColor: "#eff6ff",
    borderLeftColor: "#3b82f6",
    color: "#1e40af",
  },
  warning: {
    backgroundColor: "#fefce8",
    borderLeftColor: "#eab308",
    color: "#854d0e",
  },
  success: {
    backgroundColor: "#f0fdf4",
    borderLeftColor: "#22c55e",
    color: "#166534",
  },
};

const calloutTextStyle: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.5",
  margin: 0,
};

const buttonSectionStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: "24px",
  marginBottom: "24px",
};

const buttonStyle: React.CSSProperties = {
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center",
  padding: "12px 28px",
  display: "inline-block",
};

const imageSectionStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "20px",
};

const imageStyle: React.CSSProperties = {
  maxWidth: "100%",
  margin: "0 auto",
  borderRadius: "6px",
};

const separatorStyle: React.CSSProperties = {
  borderColor: "#e4e4e7",
  margin: "24px 0",
};
