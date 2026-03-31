"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextAlign } from "@tiptap/extension-text-align";
import {
  Bold, Italic, Link as LinkIcon, Heading1, Heading2,
  List, ListOrdered, Minus, Type, Palette, AlignLeft,
  AlignCenter, Undo, Redo, Square, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect } from "react";
import type { EmailBlock } from "@/emails/components/types";

interface TemplateEditorProps {
  initialBlocks?: EmailBlock[];
  onChange?: (blocks: EmailBlock[]) => void;
}

export function TemplateEditor({ initialBlocks, onChange }: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: "Empezá a escribir tu template..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: initialBlocks ? blocksToTipTap(initialBlocks) : "",
    onUpdate: ({ editor: e }) => {
      onChange?.(tipTapToBlocks(e));
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && initialBlocks && !editor.isFocused) {
      const content = blocksToTipTap(initialBlocks);
      const current = editor.getHTML();
      if (content !== current) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, initialBlocks]);

  if (!editor) return null;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const url = window.prompt("URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const setColor = useCallback(() => {
    const color = window.prompt("Color (hex):", "#000000");
    if (color) {
      editor.chain().focus().setColor(color).run();
    }
  }, [editor]);

  const insertCallout = useCallback((variant: string) => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "blockquote",
        attrs: { "data-variant": variant },
        content: [{ type: "paragraph", content: [{ type: "text", text: "Texto del callout..." }] }],
      })
      .run();
  }, [editor]);

  const insertButton = useCallback(() => {
    const label = window.prompt("Texto del botón:", "Click aquí");
    const href = window.prompt("URL del botón:", "https://");
    if (label && href) {
      editor
        .chain()
        .focus()
        .insertContent(`<p data-type="button" data-href="${href}">${label}</p>`)
        .run();
    }
  }, [editor]);

  const insertImage = useCallback(() => {
    const src = window.prompt("URL de la imagen:");
    if (src) {
      editor
        .chain()
        .focus()
        .insertContent(`<img src="${src}" alt="imagen" />`)
        .run();
    }
  }, [editor]);

  const btn = "h-8 w-8 p-0 shrink-0";
  const active = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs) ? "bg-muted" : "";

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30">
      <Button variant="ghost" size="icon" className={`${btn} ${active("bold")}`}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={`${btn} ${active("italic")}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button variant="ghost" size="icon" className={`${btn} ${active("heading", { level: 1 })}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={`${btn} ${active("heading", { level: 2 })}`}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={`${btn} ${active("paragraph")}`}
        onClick={() => editor.chain().focus().setParagraph().run()}>
        <Type className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button variant="ghost" size="icon" className={`${btn} ${active("bulletList")}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={`${btn} ${active("orderedList")}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button variant="ghost" size="icon" className={btn} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={setColor}>
        <Palette className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button variant="ghost" size="icon" className={btn}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button variant="ghost" size="icon" className={btn} onClick={() => insertCallout("warning")}
        title="Callout">
        <Square className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={insertButton}
        title="Botón CTA">
        <span className="text-xs font-bold">CTA</span>
      </Button>
      <Button variant="ghost" size="icon" className={btn} onClick={insertImage}
        title="Imagen">
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Separador">
        <Minus className="h-4 w-4" />
      </Button>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" className={btn}
        onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className={btn}
        onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}

function blocksToTipTap(blocks: EmailBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const level = block.attrs?.level ?? 2;
          return `<h${level}>${block.content ?? ""}</h${level}>`;
        }
        case "paragraph":
          return `<p>${block.content ?? ""}</p>`;
        case "callout":
          return `<blockquote data-variant="${block.attrs?.variant ?? "info"}">${block.content ?? ""}</blockquote>`;
        case "button":
          return `<p data-type="button" data-href="${block.attrs?.href ?? "#"}">${block.attrs?.label ?? block.content ?? "Click"}</p>`;
        case "image":
          return `<img src="${block.attrs?.src ?? ""}" alt="${block.attrs?.alt ?? ""}" />`;
        case "separator":
          return "<hr />";
        default:
          return "";
      }
    })
    .join("");
}

function tipTapToBlocks(editor: Editor): EmailBlock[] {
  const json = editor.getJSON();
  const blocks: EmailBlock[] = [];
  let idx = 0;

  for (const node of json.content ?? []) {
    const id = `block-${idx++}`;

    if (node.type === "heading") {
      blocks.push({
        id,
        type: "heading",
        content: getTextContent(node),
        attrs: { level: (node.attrs?.level ?? 2) as 1 | 2 | 3 },
      });
    } else if (node.type === "paragraph") {
      if (node.attrs?.["data-type"] === "button") {
        blocks.push({
          id,
          type: "button",
          attrs: {
            label: getPlainText(node),
            href: (node.attrs?.["data-href"] as string) ?? "#",
          },
        });
      } else {
        const html = getTextContent(node);
        if (html.trim()) {
          blocks.push({ id, type: "paragraph", content: html });
        }
      }
    } else if (node.type === "blockquote") {
      const variant = (node.attrs?.["data-variant"] as string) ?? "info";
      blocks.push({
        id,
        type: "callout",
        content: getNestedTextContent(node),
        attrs: { variant: variant as "info" | "warning" | "success" },
      });
    } else if (node.type === "horizontalRule") {
      blocks.push({ id, type: "separator" });
    } else if (node.type === "image") {
      blocks.push({
        id,
        type: "image",
        attrs: {
          src: (node.attrs?.src as string) ?? "",
          alt: (node.attrs?.alt as string) ?? "",
        },
      });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const tag = node.type === "bulletList" ? "ul" : "ol";
      const items = (node.content ?? [])
        .map((li) => `<li>${getNestedTextContent(li)}</li>`)
        .join("");
      blocks.push({
        id,
        type: "paragraph",
        content: `<${tag}>${items}</${tag}>`,
      });
    }
  }

  return blocks;
}

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

function getTextContent(node: TipTapNode): string {
  if (!node.content) return node.text ?? "";
  return node.content.map((child) => renderInlineNode(child)).join("");
}

function getNestedTextContent(node: TipTapNode): string {
  if (!node.content) return node.text ?? "";
  return node.content
    .map((child) => {
      if (child.type === "paragraph") return getTextContent(child);
      return getTextContent(child);
    })
    .join("");
}

function getPlainText(node: TipTapNode): string {
  if (!node.content) return node.text ?? "";
  return node.content.map((child) => getPlainText(child)).join("");
}

function renderInlineNode(node: TipTapNode): string {
  let html = node.text ?? "";
  if (node.type === "hardBreak") return "<br/>";
  if (!node.marks) return html;

  for (const mark of node.marks) {
    if (mark.type === "bold") html = `<strong>${html}</strong>`;
    if (mark.type === "italic") html = `<em>${html}</em>`;
    if (mark.type === "link") html = `<a href="${mark.attrs?.href ?? "#"}">${html}</a>`;
    if (mark.type === "textStyle" && mark.attrs?.color)
      html = `<span style="color:${mark.attrs.color}">${html}</span>`;
  }

  return html;
}

export { tipTapToBlocks, blocksToTipTap };
