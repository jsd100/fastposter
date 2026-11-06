import type { ProjectAction } from "./ProjectList";

/**
 * One entry of the card menu. The menu itself is an antd `Dropdown`, whose
 * popup only exists once it is opened, so the actions a card offers are
 * declared here as data and `ProjectList` renders them. That keeps the
 * contract — which actions a normal poster offers, and that a deleted one is
 * never reachable from this menu — assertible without a browser.
 */
export type CardMenuItem = {
  action: ProjectAction;
  text: string;
  danger?: boolean;
};

export const CARD_MENU: readonly CardMenuItem[] = [
  { action: "rename", text: "重命名" },
  { action: "clone", text: "复制作品" },
  { action: "delete", text: "移到回收站", danger: true },
];
