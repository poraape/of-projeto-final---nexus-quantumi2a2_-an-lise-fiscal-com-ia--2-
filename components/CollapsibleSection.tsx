import React, { useState } from 'react';
// FIX: Corrected module import paths to be relative.
import { ChevronDownIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-t border-gray-700/50 pt-6 last:border-b last:pb-6">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left text-gray-200 hover:text-white transition-colors">
                <h2 className="text-xl font-bold">{title}</h2>
                <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="mt-4 animate-fade-in-down">{children}</div>}
        </div>
    );
};

export default CollapsibleSection;