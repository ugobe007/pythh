/**
 * GALLERY FILTERS - The Control Surface
 * =====================================
 * Determines what founders learn.
 * Makes browsing immediately personal.
 */

import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface GalleryFilters {
  stage: string | null;
  industry: string | null;
  geography: string | null;
  alignmentState: string | null;
}

interface GalleryFiltersProps {
  filters: GalleryFilters;
  onChange: (filters: GalleryFilters) => void;
  defaultStage?: string;
  defaultIndustry?: string;
}

// Filter options
const STAGES = [
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
];

const INDUSTRIES = [
  { value: 'ai', label: 'AI' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'devtools', label: 'Devtools' },
  { value: 'climate', label: 'Climate' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'enterprise', label: 'Enterprise' },
];

const GEOGRAPHIES = [
  { value: 'bay-area', label: 'Bay Area' },
  { value: 'nyc', label: 'NYC' },
  { value: 'europe', label: 'Europe' },
  { value: 'remote', label: 'Remote' },
];

const ALIGNMENT_STATES = [
  { value: 'active', label: 'Active' },
  { value: 'forming', label: 'Forming' },
  { value: 'limited', label: 'Limited' },
];

interface FilterDropdownProps {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
  placeholder?: string;
}

function FilterDropdown({ label, value, options, onChange, placeholder }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = options.find(o => o.value === value);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm
          ${value 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' 
            : 'bg-[#111111] border-gray-800 text-gray-400 hover:border-gray-700'
          }
        `}
      >
        <span className="text-gray-500 text-xs">{label}:</span>
        <span>{selectedOption?.label || placeholder || 'All'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl z-50 py-1">
            <button
              onClick={() => { onChange(null); setIsOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                !value ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              All
            </button>
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  value === option.value 
                    ? 'text-amber-400 bg-amber-500/10' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function GalleryFiltersBar({ 
  filters, 
  onChange,
  defaultStage,
  defaultIndustry 
}: GalleryFiltersProps) {
  
  const activeFilters = [
    filters.stage,
    filters.industry,
    filters.geography,
    filters.alignmentState
  ].filter(Boolean).length;
  
  const clearAllFilters = () => {
    onChange({
      stage: null,
      industry: null,
      geography: null,
      alignmentState: null
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterDropdown
        label="Stage"
        value={filters.stage}
        options={STAGES}
        onChange={(stage) => onChange({ ...filters, stage })}
        placeholder={defaultStage || 'All'}
      />
      
      <FilterDropdown
        label="Industry"
        value={filters.industry}
        options={INDUSTRIES}
        onChange={(industry) => onChange({ ...filters, industry })}
        placeholder={defaultIndustry || 'All'}
      />
      
      <FilterDropdown
        label="Geography"
        value={filters.geography}
        options={GEOGRAPHIES}
        onChange={(geography) => onChange({ ...filters, geography })}
      />
      
      <FilterDropdown
        label="Alignment"
        value={filters.alignmentState}
        options={ALIGNMENT_STATES}
        onChange={(alignmentState) => onChange({ ...filters, alignmentState })}
      />
      
      {activeFilters > 0 && (
        <button
          onClick={clearAllFilters}
          className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );
}

export { STAGES, INDUSTRIES, GEOGRAPHIES, ALIGNMENT_STATES };
