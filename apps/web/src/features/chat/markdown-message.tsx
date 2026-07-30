import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ children }: { children: string }) {
  return (
    <div className="space-y-3 leading-7 text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: linkText, ...properties }) => (
            <a
              {...properties}
              className="font-medium text-teal-700 underline underline-offset-4"
              rel="noreferrer noopener"
              target="_blank"
            >
              {linkText}
            </a>
          ),
          code: ({ children: code, className, ...properties }) => (
            <code
              {...properties}
              className={`${className ?? ""} rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm`}
            >
              {code}
            </code>
          ),
          ol: ({ children: items }) => <ol className="ml-5 list-decimal space-y-1">{items}</ol>,
          ul: ({ children: items }) => <ul className="ml-5 list-disc space-y-1">{items}</ul>,
          pre: ({ children: code }) => (
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-slate-100">{code}</pre>
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
