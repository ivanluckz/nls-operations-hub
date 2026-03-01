import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Zap, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface ParsedAction {
  type: string;
  [key: string]: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ParsedAction[];
}

const getDisplayContent = (msg: ChatMessage) => {
  return msg.content.replace(/<ACTION>.*?<\/ACTION>/gs, "").trim();
};

interface DevMessageBubbleProps {
  msg: ChatMessage;
  msgIdx: number;
  executingIdx: string | null;
  onExecute: (msgIdx: number, actionIdx: number, action: ParsedAction) => void;
}

const DevMessageBubble = ({ msg, msgIdx, executingIdx, onExecute }: DevMessageBubbleProps) => {
  const [openActions, setOpenActions] = useState<Record<number, boolean>>({});

  const toggleAction = (idx: number) => {
    setOpenActions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const displayContent = getDisplayContent(msg);
  const hasTable = displayContent.includes('|---') || displayContent.includes('| ---');

  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`${hasTable && msg.role === "assistant" ? "max-w-[95%] md:max-w-[90%]" : "max-w-[85%] md:max-w-[70%]"} ${
          msg.role === "user"
            ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-100 rounded-lg px-4 py-2.5 font-mono text-sm"
            : "bg-zinc-900/80 border border-zinc-700/50 rounded-lg px-4 py-3"
        }`}
      >
        {msg.role === "assistant" ? (
          <div className="prose prose-sm prose-invert max-w-none font-mono text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3 rounded-lg border border-zinc-700/60">
                      <table className="w-full border-collapse text-xs font-mono">
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return <thead className="bg-zinc-800/90">{children}</thead>;
                },
                th({ children }) {
                  return (
                    <th className="border border-zinc-700 px-3 py-2 text-left text-cyan-300 font-bold text-xs whitespace-nowrap">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="border border-zinc-700/50 px-3 py-1.5 text-xs text-zinc-300 whitespace-nowrap">
                      {children}
                    </td>
                  );
                },
                tr({ children }) {
                  return <tr className="hover:bg-zinc-800/40 transition-colors">{children}</tr>;
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const inline = !match;
                  return !inline ? (
                    <SyntaxHighlighter
                      style={atomDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: "0.5rem 0",
                        borderRadius: "0.5rem",
                        fontSize: "0.75rem",
                        border: "1px solid rgba(63, 63, 70, 0.5)",
                      }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className="bg-zinc-800 text-cyan-300 px-1.5 py-0.5 rounded text-xs border border-zinc-700/50"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <span className="text-emerald-400 select-none shrink-0">$</span>
            <p className="text-sm">{msg.content}</p>
          </div>
        )}

        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-3 space-y-2">
            {msg.actions.map((action, ai) => (
              <Collapsible
                key={ai}
                open={openActions[ai] ?? false}
                onOpenChange={() => toggleAction(ai)}
              >
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg overflow-hidden">
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-500/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 font-mono uppercase">
                        {action.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-amber-400/60 transition-transform ${
                        openActions[ai] ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      <SyntaxHighlighter
                        style={atomDark}
                        language="json"
                        customStyle={{
                          margin: 0,
                          borderRadius: "0.375rem",
                          fontSize: "0.7rem",
                          border: "1px solid rgba(63, 63, 70, 0.4)",
                        }}
                      >
                        {JSON.stringify(action, null, 2)}
                      </SyntaxHighlighter>
                      <Button
                        size="sm"
                        onClick={() => onExecute(msgIdx, ai, action)}
                        disabled={executingIdx === `${msgIdx}-${ai}`}
                        className="bg-amber-500 hover:bg-amber-600 text-black font-mono text-xs h-7"
                      >
                        {executingIdx === `${msgIdx}-${ai}` ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" /> Executing...
                          </>
                        ) : (
                          <>⚡ Execute</>
                        )}
                      </Button>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevMessageBubble;
