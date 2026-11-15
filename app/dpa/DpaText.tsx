export default function DpaText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const list: React.ReactNode[] = [];

  function flushList() {
    if (list.length === 0) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{list.splice(0)}</ul>);
  }

  text.split("\n").forEach((line, index) => {
    if (line.startsWith("- ")) {
      list.push(<li key={index}>{line.slice(2)}</li>);
      return;
    }
    flushList();
    if (line.startsWith("## ")) {
      blocks.push(<h3 key={index}>{line.slice(3)}</h3>);
      return;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h2 key={index}>{line.slice(2)}</h2>);
      return;
    }
    if (line.trim() === "") return;
    blocks.push(<p key={index}>{line}</p>);
  });
  flushList();
  return <div className="space-y-3 break-words leading-relaxed">{blocks}</div>;
}
