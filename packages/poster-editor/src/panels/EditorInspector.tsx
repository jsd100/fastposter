import { Segmented } from "antd";
import { Button } from "@fastposter/ui";
import { Plus, Type } from "lucide-react";
import { useId, type ReactNode } from "react";
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
  /** Shared capacity/font-readiness rule, identical on phone and desktop. */
  addDisabled?: boolean;
  addDisabledReason?: string;
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
  addDisabled = false,
  addDisabledReason = "",
  showAdd = false,
  scopeLabel = "",
  actions,
}: EditorInspectorProps) {
  const groupName = useId();
  return (
    <div className="editor-inspector">
      {showAdd && (
        <div className="inspector-add">
          <Button
            disabled={addDisabled}
            title={addDisabledReason || undefined}
            onClick={onAddText}
          >
            <Plus size={15} />
            添加文字
          </Button>
        </div>
      )}
      <div className="inspector-tabs">
        <Segmented<InspectorGroup>
          block
          name={groupName}
          aria-label="属性分组"
          options={groups}
          value={group}
          onChange={onGroupChange}
        />
      </div>
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
