import React from 'react';
import { Delete } from 'lucide-react';

interface CustomKeyboardProps {
  value: string;
  onChange: (value: string) => void;
}

export const CustomKeyboard: React.FC<CustomKeyboardProps> = ({ value, onChange }) => {
  const handleKeyPress = (key: string) => {
    // Backspace logic
    if (key === 'backspace') {
      if (value.length <= 1) {
        onChange('0');
      } else {
        onChange(value.slice(0, -1));
      }
      return;
    }

    // Decimal logic
    if (key === '.') {
      if (value.includes('.')) return; // Prevent multiple decimal points
      onChange(value + '.');
      return;
    }

    // Number logic
    // Prevent typing if already has 2 decimals
    if (value.includes('.')) {
      const [, decimals] = value.split('.');
      if (decimals.length >= 2) return;
    }

    // Prevent huge numbers (over 10 million)
    if (parseFloat(value) > 10000000 && key !== 'backspace') return;

    if (value === '0') {
      onChange(key);
    } else {
      onChange(value + key);
    }
  };

  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'backspace'
  ];

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[320px] mx-auto px-4 pb-4">
      {keys.map((key) => {
        const isBackspace = key === 'backspace';
        const isSpecial = key === '.' || isBackspace;

        return (
          <button
            key={key}
            onClick={() => handleKeyPress(key)}
            type="button"
            className={`
              h-14 flex items-center justify-center rounded-2xl text-xl font-semibold
              transition-all active:scale-90 duration-100 select-none
              ${isSpecial
                ? 'bg-slate-800/40 text-slate-300 hover:bg-slate-800/60'
                : 'bg-slate-800/80 text-white hover:bg-slate-800'
              }
              shadow-sm active:bg-slate-700
            `}
          >
            {isBackspace ? <Delete className="w-5 h-5 text-slate-300" /> : key}
          </button>
        );
      })}
    </div>
  );
};
