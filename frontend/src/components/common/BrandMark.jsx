import { Boxes } from 'lucide-react';

export function BrandMark({ size = 'md' }) {
  const boxSize = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div className={`${boxSize} grid shrink-0 place-items-center rounded-lg bg-enterprise-blue text-white shadow-inner`}>
      <Boxes size={size === 'sm' ? 21 : 26} />
    </div>
  );
}
