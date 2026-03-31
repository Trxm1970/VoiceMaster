import React, { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';

interface SSMLViewerProps {
  ssml: string;
}

export const SSMLViewer: React.FC<SSMLViewerProps> = ({ ssml }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ssml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlighting for XML
  const highlightedSSML = ssml.split(/(<[^>]+>)/g).map((chunk, index) => {
    if (chunk.startsWith('<') && chunk.endsWith('>')) {
      // Tags in Brand color (Yellow)
      return <span key={index} className="text-brand-400 font-semibold">{chunk}</span>;
    }
    // Content
    return <span key={index} className="text-slate-300">{chunk}</span>;
  });

  return (
    <div className="relative group">
      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
         <button
          onClick={handleCopy}
          className="flex items-center gap-2 bg-navy-800/80 backdrop-blur-sm text-xs text-white px-3 py-1.5 rounded-md hover:bg-brand-400 hover:text-navy-950 transition-colors border border-brand-400/30"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Đã sao chép' : 'Sao chép SSML'}
        </button>
      </div>

      <div className="bg-[#0a1428] rounded-lg border border-brand-500/20 overflow-hidden shadow-inner">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#16254a] border-b border-brand-500/20">
          <Code size={14} className="text-brand-400" />
          <span className="text-xs font-mono text-slate-500">output.ssml</span>
        </div>
        <div className="p-4 overflow-x-auto overflow-y-auto max-h-[500px] font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {highlightedSSML}
        </div>
      </div>
    </div>
  );
};