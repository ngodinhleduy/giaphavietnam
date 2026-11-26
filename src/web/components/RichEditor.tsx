// Trình soạn thảo HTML cho tiểu sử và bài viết. Chỉ tải trong trang quản trị (lazy) để trang xem nhẹ.
import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder, CharacterCount } from '@tiptap/extensions';
import { marked } from 'marked';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, fileUrl, shrinkImage } from '../lib/api.ts';
import { cx, Input, Button, Modal, Spinner, useToast } from './ui.tsx';

/** Nội dung cũ viết bằng Markdown thì chuyển sang HTML trước khi đưa vào editor. */
function toHtml(v: string) {
  if (!v) return '';
  return /^\s*</.test(v) ? v : (marked.parse(v, { async: false }) as string);
}

export default function RichEditor({ value, onChange, placeholder = 'Bắt đầu viết...', minHeight = 240, id }: {
  value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number; id?: string;
}) {
  const last = useRef(value);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: toHtml(value),
    editorProps: {
      attributes: {
        id: id ?? '',
        class: 'prose-gp px-4 py-3 focus:outline-none',
        style: `min-height:${minHeight}px`,
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML();
      last.current = html;
      onChange(html);
    },
  });

  // Đồng bộ khi giá trị đổi từ bên ngoài (ví dụ tải xong dữ liệu)
  useEffect(() => {
    if (editor && value !== last.current) {
      editor.commands.setContent(toHtml(value), { emitUpdate: false });
      last.current = value;
    }
  }, [value, editor]);

  if (!editor) return <div className="h-60 rounded-lg border border-line-strong bg-surface" />;
  return (
    <div className="rounded-lg border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <Footer editor={editor} />
    </div>
  );
}

function Footer({ editor }: { editor: Editor }) {
  const words = useEditorState({ editor, selector: (s) => ((s.editor.storage as any).characterCount?.words?.() as number | undefined) ?? 0 });
  return <div className="px-4 py-1.5 border-t border-line text-xs text-ink-3 text-right tabular-nums">{words} từ</div>;
}

function Btn({ on, label, active, disabled, children }: {
  on: () => void; label: string; active?: boolean; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={on} aria-label={label} title={label} aria-pressed={active}
      disabled={disabled}
      className={cx('size-8 pointer-coarse:size-10 shrink-0 inline-flex items-center justify-center rounded-md text-ink-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
        active ? 'bg-accent-soft text-accent' : 'hover:bg-sunken hover:text-ink')}>
      {children}
    </button>
  );
}
const Sep = () => <span className="w-px h-5 bg-line mx-1 shrink-0" aria-hidden />;
const I = ({ d, ...p }: { d: string; fill?: string }) => (
  <svg viewBox="0 0 20 20" className="size-[18px]" fill={p.fill ?? 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

function Toolbar({ editor }: { editor: Editor }) {
  const toast = useToast();
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }), h4: e.isActive('heading', { level: 4 }),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'), link: e.isActive('link'),
      left: e.isActive({ textAlign: 'left' }), center: e.isActive({ textAlign: 'center' }), right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const block = st.h2 ? 'h2' : st.h3 ? 'h3' : st.h4 ? 'h4' : 'p';
  const c = () => editor.chain().focus();

  const upload = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try {
      const r = await api.upload(await shrinkImage(f));
      c().setImage({ src: fileUrl(r.id), alt: f.name.replace(/\.[^.]+$/, '') }).run();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };

  const openLink = () => {
    setHref(editor.getAttributes('link').href ?? '');
    setLinkOpen(true);
  };
  const applyLink = () => {
    const v = href.trim();
    if (!v) c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|tel:|\/)/.test(v) ? v : `https://${v}` }).run();
    setLinkOpen(false);
  };

  return (
    <div role="toolbar" aria-label="Định dạng văn bản"
      className="sticky top-0 z-10 flex items-center gap-0.5 px-1.5 py-1 border-b border-line bg-surface overflow-x-auto [scrollbar-width:none]">
      <Btn on={() => c().undo().run()} label="Hoàn tác (Ctrl+Z)" disabled={!st.undo}><I d="M7 8H13a4 4 0 010 8H9M7 8l3-3M7 8l3 3" /></Btn>
      <Btn on={() => c().redo().run()} label="Làm lại (Ctrl+Shift+Z)" disabled={!st.redo}><I d="M13 8H7a4 4 0 000 8h4M13 8l-3-3M13 8l-3 3" /></Btn>
      <Sep />
      <select aria-label="Kiểu đoạn" value={block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') c().setParagraph().run();
          else c().toggleHeading({ level: +v.slice(1) as 2 | 3 | 4 }).run();
        }}
        className="h-8 pointer-coarse:h-10 shrink-0 rounded-md border-0 bg-transparent px-2 text-sm text-ink hover:bg-sunken cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30">
        <option value="p">Đoạn văn</option>
        <option value="h2">Tiêu đề lớn</option>
        <option value="h3">Tiêu đề vừa</option>
        <option value="h4">Tiêu đề nhỏ</option>
      </select>
      <Sep />
      <Btn on={() => c().toggleBold().run()} label="In đậm (Ctrl+B)" active={st.bold}><span className="font-bold text-[15px]">B</span></Btn>
      <Btn on={() => c().toggleItalic().run()} label="In nghiêng (Ctrl+I)" active={st.italic}><span className="italic font-serif text-[16px]">I</span></Btn>
      <Btn on={() => c().toggleUnderline().run()} label="Gạch chân (Ctrl+U)" active={st.underline}><span className="underline text-[15px]">U</span></Btn>
      <Btn on={() => c().toggleStrike().run()} label="Gạch ngang" active={st.strike}><span className="line-through text-[15px]">S</span></Btn>
      <Sep />
      <Btn on={() => c().toggleBulletList().run()} label="Danh sách chấm" active={st.bullet}><I d="M8 5h9M8 10h9M8 15h9M4 5h.01M4 10h.01M4 15h.01" /></Btn>
      <Btn on={() => c().toggleOrderedList().run()} label="Danh sách số" active={st.ordered}><I d="M9 5h8M9 10h8M9 15h8M4 4v3M3.5 13.5h1.5l-1.5 2h1.5" /></Btn>
      <Btn on={() => c().toggleBlockquote().run()} label="Trích dẫn" active={st.quote}><I d="M5 6h4v4H6l-1 3M12 6h4v4h-3l-1 3" /></Btn>
      <Btn on={() => c().setHorizontalRule().run()} label="Đường kẻ ngang"><I d="M3 10h14" /></Btn>
      <Sep />
      <Btn on={() => c().setTextAlign('left').run()} label="Căn trái" active={st.left}><I d="M3 5h14M3 9h9M3 13h14M3 17h9" /></Btn>
      <Btn on={() => c().setTextAlign('center').run()} label="Căn giữa" active={st.center}><I d="M3 5h14M5.5 9h9M3 13h14M5.5 17h9" /></Btn>
      <Btn on={() => c().setTextAlign('right').run()} label="Căn phải" active={st.right}><I d="M3 5h14M8 9h9M3 13h14M8 17h9" /></Btn>
      <Btn on={() => c().setTextAlign('justify').run()} label="Căn đều" active={st.justify}><I d="M3 5h14M3 9h14M3 13h14M3 17h14" /></Btn>
      <Sep />
      <Btn on={openLink} label="Chèn liên kết (Ctrl+K)" active={st.link}><I d="M8.5 11.5a3 3 0 004.2 0l2.6-2.6a3 3 0 00-4.2-4.2l-.8.8M11.5 8.5a3 3 0 00-4.2 0L4.7 11.1a3 3 0 004.2 4.2l.8-.8" /></Btn>
      <Btn on={() => file.current?.click()} label="Chèn ảnh" disabled={uploading}>
        {uploading ? <Spinner className="size-4" /> : <I d="M3 5.5A1.5 1.5 0 014.5 4h11A1.5 1.5 0 0117 5.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 14.5zM3 13l4-4 3 3 2-2 5 5M12.5 7.5h.01" />}
      </Btn>
      <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files?.[0])} />
      <Btn on={() => c().unsetAllMarks().clearNodes().run()} label="Xóa định dạng"><I d="M6 4h9M10.5 4L8 16M4 16h6M13 12l4 4M17 12l-4 4" /></Btn>

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Chèn liên kết" width="max-w-md"
        footer={<>
          {st.link && <Button variant="ghost" onClick={() => { c().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>Gỡ liên kết</Button>}
          <Button onClick={() => setLinkOpen(false)}>Hủy</Button>
          <Button variant="primary" onClick={applyLink}>Áp dụng</Button>
        </>}>
        <label htmlFor="rte-href" className="text-sm font-medium">Địa chỉ</label>
        <Input id="rte-href" className="mt-1.5" placeholder="https://..." value={href} onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyLink())} />
        <p className="mt-2 text-sm text-ink-3">Bôi đen chữ trước khi chèn để biến chữ đó thành liên kết.</p>
      </Modal>
    </div>
  );
}
