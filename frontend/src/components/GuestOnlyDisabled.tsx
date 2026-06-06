import React, { useState } from 'react';

interface GuestOnlyDisabledProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: React.ReactElement<any>;
  tooltip?: string;
  tooltipAlign?: 'left' | 'center' | 'right';
}

export const GuestOnlyDisabled: React.FC<GuestOnlyDisabledProps> = ({
  children,
  tooltip = 'Sign in to use this feature',
  tooltipAlign = 'center',
}) => {
  const [show, setShow] = useState(false);

  const existingClass: string = (children.props as { className?: string }).className ?? '';

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {React.cloneElement(children, {
        disabled: true,
        className: `${existingClass} opacity-50 cursor-not-allowed`,
      })}
      {show && (
        <div
          className={`absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg px-2 py-1 text-xs shadow-pop pointer-events-none ${
            tooltipAlign === 'left' ? 'left-0' : tooltipAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
          }`}
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
        >
          {tooltip}
          <div
            className={`absolute top-full border-4 border-transparent ${
              tooltipAlign === 'left' ? 'left-3' : tooltipAlign === 'right' ? 'right-3' : 'left-1/2 -translate-x-1/2'
            }`}
            style={{ borderTopColor: 'var(--text)' }}
          />
        </div>
      )}
    </div>
  );
};
