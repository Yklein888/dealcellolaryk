import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface POSProductSearchProps {
  value: string;
  onChange: (value: string) => void;
  categories: (string | null)[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function POSProductSearch({
  value,
  onChange,
  categories,
  selectedCategory,
  onCategoryChange,
}: POSProductSearchProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חפש מוצר..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange(null)}
          >
            הכל
          </Button>
          {categories.map((category) => (
            category && (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => onCategoryChange(category)}
              >
                {category}
              </Button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
