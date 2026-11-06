import { Button } from "@fastposter/ui";
import { Plus, Type } from "lucide-react";
import type { ReactNode } from "react";
import { TextPanel, type TextPanelProps } from "./TextPanel";
export type InspectorGroup = "text" | "paragraph" | "effects" | "position";
const groups: { value: InspectorGroup; label: string }[] = [
  { value: "text", label: "文字" },
  { value: "paragraph", label: "段落" },
  { value: "effects", label: "效果" },
  { value: "position", label: "位置" },
];
export type EditorInspectorProps = {
  group: InspectorGroup;
  onGroupChange: (group: InspectorGroup) => void;
  textPanel: TextPanelProps | null;
  position: ReactNode;
  onAddText: () => void;
  /** The phone sheet owns the only creation entry while it is open. */
  showAdd?: boolean;
  scopeLabel?: string;
  actions?: ReactNode;
};
export function EditorInspector({
  group,
  onGroupChange,
  textPanel,
  position,
  onAddText,
  showAdd = false,
  scopeLabel = "",
  actions,
}: EditorInspectorProps) {
  return (
    <div className="editor-inspector">
      {showAdd && (
        <div className="inspector-add">
          <Button onClick={onAddText}>
            <Plus size={15} />
            添加文字
          </Button>
        </div>
      )}
      <nav className="inspector-tabs" aria-label="属性分组">
        {groups.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={group === value}
            className="inspector-tab"
            onClick={() => onGroupChange(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="inspector-content">
        {textPanel ? (
          <>
            <div className="selection-scope">
              <span>当前文字块</span>
              <strong>{scopeLabel}</strong>
            </div>
            {actions}
            {group === "position" ? (
              position
            ) : (
              <TextPanel group={group} {...textPanel} />
            )}
          </>
        ) : (
          <div className="properties-empty">
            <Type size={28} />
            <p>
              选择一个文字块
              <br />
              开始调整排版
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
