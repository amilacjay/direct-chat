import React from 'react';

interface Props {
  gender: string;
  className?: string;
}

export const GenderIcon: React.FC<Props> = ({ gender, className = 'h-3.5 w-3.5' }) => {
  if (gender === 'male') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Male">
        <circle cx="10" cy="14" r="5" stroke="currentColor" strokeWidth={2} />
        <path d="M15.5 8.5 20 4m0 0h-4m4 0v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (gender === 'female') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Female">
        <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth={2} />
        <path d="M12 13v8m-3-3h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  if (gender === 'nonbinary') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Non-binary">
        <circle cx="12" cy="11" r="4" stroke="currentColor" strokeWidth={2} />
        <path d="M12 15v6m-2.5-3h5M9 7 6 4m12 0-3 3M9 4H6v3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
};

export const genderLabel: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  nonbinary: 'Non-binary',
  other: 'Other',
};

export const genderColor: Record<string, string> = {
  male: 'text-blue-400',
  female: 'text-pink-400',
  nonbinary: 'text-purple-400',
  other: 'text-ink-3',
};
