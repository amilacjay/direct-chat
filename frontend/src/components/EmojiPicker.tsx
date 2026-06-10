import React, { useEffect, useRef, useState } from 'react';

// A curated, dependency-free emoji set grouped by category. Native unicode
// glyphs render everywhere, so there's nothing to bundle or load.
const EMOJI: Record<string, string[]> = {
  Smileys: [
    '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩', '😅',
    '😆', '🙂', '🙃', '😉', '😌', '😋', '😜', '🤪', '😝', '🤗',
    '🤔', '🤨', '😐', '😏', '😒', '🙄', '😬', '😴', '😷', '🥳',
    '🥺', '😢', '😭', '😤', '😠', '😡', '🤯', '😳', '🥵', '🥶',
    '😱', '😨', '😰', '😇', '🤠', '🤓', '🧐', '🤤',
  ],
  Gestures: [
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '🙏',
    '🤝', '💪', '👋', '🤙', '👈', '👉', '👆', '👇', '✊', '👊',
    '🤛', '🤜', '✋', '🖐️', '🖖', '🫶', '👐', '🫰',
  ],
  Hearts: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️',
  ],
  Animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄',
    '🐝', '🦋', '🐢', '🐠', '🐬', '🐳', '🦀', '🐙',
  ],
  Food: [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍔', '🍟', '🍕',
    '🌭', '🥪', '🌮', '🍿', '🍩', '🍪', '🎂', '🍰', '🍫', '🍬',
    '🍭', '☕', '🍺', '🥂', '🍷', '🧋',
  ],
  Fun: [
    '⚽', '🏀', '🏈', '⚾', '🎾', '🎱', '🏓', '🎯', '🎮', '🎲',
    '🎸', '🎤', '🎧', '🎬', '🎨', '🎉', '🎊', '🎁', '🏆', '🥇',
    '🚀', '✨', '🔥', '🌟', '⭐', '🌈', '☀️', '🌙',
  ],
  Symbols: [
    '💯', '✅', '❌', '❓', '❗', '⚠️', '💤', '💢', '💥', '💫',
    '💦', '🎵', '🎶', '➕', '➖', '✔️', '🔔', '💡', '🔒', '👀',
    '💬', '🆗', '🚫', '♻️',
  ],
};

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  // Clicks inside this element (the toggle button) don't count as "outside",
  // so the button can handle its own open/close toggle without a race.
  anchorRef?: React.RefObject<HTMLElement>;
}

export const EmojiPicker: React.FC<Props> = ({ onSelect, onClose, anchorRef }) => {
  const ref = useRef<HTMLDivElement>(null);
  const categories = Object.keys(EMOJI);
  const [category, setCategory] = useState(categories[0]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (anchorRef?.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  return (
    <div
      ref={ref}
      data-testid="emoji-picker"
      className="absolute bottom-full right-0 z-20 mb-2 w-[min(340px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-line bg-surface shadow-soft"
    >
      {/* Category tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-line px-1.5 py-1.5">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            title={c}
            className={`flex-shrink-0 rounded-lg px-2 py-1 text-lg leading-none transition-colors hover:bg-surface2 ${
              category === c ? 'bg-surface2' : ''
            }`}
          >
            {EMOJI[c][0]}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="max-h-52 overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI[category].map((emoji) => (
            <button
              key={emoji}
              type="button"
              data-testid="emoji-option"
              onClick={() => onSelect(emoji)}
              className="grid h-9 w-9 place-items-center rounded-lg text-xl leading-none transition-colors hover:bg-surface2"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
