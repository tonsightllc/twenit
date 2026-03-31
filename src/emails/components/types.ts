export type BlockType =
  | "heading"
  | "paragraph"
  | "callout"
  | "button"
  | "image"
  | "separator";

export interface EmailBlock {
  id: string;
  type: BlockType;
  content?: string;
  attrs?: {
    level?: 1 | 2 | 3;
    variant?: "info" | "warning" | "success";
    href?: string;
    label?: string;
    src?: string;
    alt?: string;
  };
}
