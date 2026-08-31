"use client";

export default function HelpOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="help-backdrop" onClick={onClose} role="presentation">
      <div
        className="help-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="help-title"
      >
        <h2 id="help-title">画布快捷键</h2>
        <ul>
          <li>
            <kbd>空白处拖拽</kbd>
            <span>框选多个节点</span>
          </li>
          <li>
            <kbd>Space + 拖拽</kbd>
            <span>平移画布</span>
          </li>
          <li>
            <kbd>Shift + 点击</kbd>
            <span>加减选中节点</span>
          </li>
          <li>
            <kbd>双击节点</kbd>
            <span>编辑文字</span>
          </li>
          <li>
            <kbd>拖到空白处</kbd>
            <span>从节点拉出子节点</span>
          </li>
          <li>
            <kbd>Tab</kbd>
            <span>添加子节点，随后自动排版</span>
          </li>
          <li>
            <kbd>Enter</kbd>
            <span>添加同级节点，随后自动排版</span>
          </li>
          <li>
            <kbd>Delete</kbd>
            <span>删除子树并重新排版</span>
          </li>
          <li>
            <kbd>L</kbd>
            <span>ELK 向右整理；Shift+L 辐射排版</span>
          </li>
          <li>
            <kbd>⌘ / Ctrl + S</kbd>
            <span>立即保存</span>
          </li>
          <li>
            <kbd>?</kbd>
            <span>打开或关闭本说明</span>
          </li>
        </ul>
        <button type="button" className="tool-btn" onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );
}
