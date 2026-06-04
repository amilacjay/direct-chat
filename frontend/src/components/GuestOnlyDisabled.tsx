import React, { useState } from 'react';

interface GuestOnlyDisabledProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: React.ReactElement<any>;
  tooltip?: string;
}

export const GuestOnlyDisabled: React.FC<GuestOnlyDisabledProps> = ({
  children,
  tooltip = 'Sign in to use this feature',
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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 pointer-events-none">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
};
