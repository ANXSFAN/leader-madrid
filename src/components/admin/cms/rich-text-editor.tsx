"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import BulletListExt from "@tiptap/extension-bullet-list";
import ListItemExt from "@tiptap/extension-list-item";
import LinkExtension from "@tiptap/extension-link";
import TextAlignExtension from "@tiptap/extension-text-align";
import UnderlineExtension from "@tiptap/extension-underline";
import PlaceholderExtension from "@tiptap/extension-placeholder";
import ImageResize from "tiptap-extension-resize-image";

/**
 * Custom BulletList that preserves `class` attribute (e.g. class="features").
 * Custom ListItem that preserves `data-icon` attribute for CSS icon rendering.
 * This allows AI-generated HTML with structured classes to survive Tiptap round-trips.
 */
const CustomBulletList = BulletListExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("class"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
    };
  },
});

const CustomListItem = ListItemExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-icon": {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-icon"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes["data-icon"]) return {};
          return { "data-icon": attributes["data-icon"] };
        },
      },
    };
  },
});
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Minus,
  Undo,
  Redo,
  Code2,
  ImagePlus,
  Upload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarBtn({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 p-0 rounded flex items-center justify-center transition-colors shrink-0",
        isActive
          ? "bg-accent text-accent-foreground hover:bg-accent/90"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-0.5 self-center shrink-0" />;
}

const isEmptyContent = (html: string) => !html || html === "<p></p>";

/** Image insert popover: upload file or paste URL */
function ImageInsertPopover({ onInsert }: { onInsert: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlInsert = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onInsert(trimmed);
    setUrlInput("");
    setOpen(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "images");
      formData.append("path", "cms");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      onInsert(data.url);
      setOpen(false);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert Image"
          className={cn(
            "h-7 w-7 p-0 rounded flex items-center justify-center transition-colors shrink-0",
            open
              ? "bg-accent text-accent-foreground hover:bg-accent/90"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <Tabs defaultValue="upload">
          <TabsList className="w-full h-8 mb-3">
            <TabsTrigger value="upload" className="flex-1 text-xs h-7">
              <Upload className="h-3 w-3 mr-1.5" />
              上传文件
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 text-xs h-7">
              <Link className="h-3 w-3 mr-1.5" />
              图片 URL
            </TabsTrigger>
          </TabsList>

          {/* Upload tab */}
          <TabsContent value="upload" className="mt-0">
            <label
              className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                uploading
                  ? "border-accent bg-accent/10 cursor-not-allowed"
                  : "border-border hover:border-accent hover:bg-accent/5"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-accent mb-1" />
                  <span className="text-xs text-muted-foreground">上传中...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">点击选择图片</span>
                  <span className="text-[10px] text-muted-foreground/60 mt-0.5">JPG / PNG / WebP / GIF</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>
          </TabsContent>

          {/* URL tab */}
          <TabsContent value="url" className="mt-0 space-y-2">
            <Input
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUrlInsert();
                }
              }}
              className="h-8 text-sm"
            />
            <button
              type="button"
              onClick={handleUrlInsert}
              disabled={!urlInput.trim()}
              className="w-full h-8 rounded bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              插入图片
            </button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: false,
        listItem: false,
      }),
      CustomBulletList,
      CustomListItem,
      UnderlineExtension,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "rte-link" },
      }),
      TextAlignExtension.configure({ types: ["heading", "paragraph"] }),
      PlaceholderExtension.configure({ placeholder: placeholder || "" }),
      ImageResize,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[280px] px-4 py-3 rte-content",
      },
    },
  });

  // Sync external value changes (e.g. AI translate fills in other locales)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (isEmptyContent(value) && isEmptyContent(current)) return;
    if (value === current) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const insertImage = useCallback(
    (url: string) => {
      (editor?.chain().focus() as any).setImage({ src: url }).run();
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div
      className={cn(
        "border border-input rounded-xl overflow-hidden bg-background",
        className
      )}
    >
      {/* Toolbar */}
      <div className="bg-muted/40 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
        {/* Undo / Redo */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Sep />

        {/* Inline formatting */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline"
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="Inline Code"
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Sep />

        {/* Headings */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Sep />

        {/* Lists */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Ordered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Sep />

        {/* Block */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Sep />

        {/* Alignment */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <Sep />

        {/* Link */}
        <ToolbarBtn
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="Link"
        >
          <Link className="h-3.5 w-3.5" />
        </ToolbarBtn>

        {/* Image */}
        <ImageInsertPopover onInsert={insertImage} />

        {/* HR */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
