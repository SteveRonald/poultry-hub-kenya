import { MapPin, Package, Plus, ShoppingCart, Star, Store } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import ChatButton from './ChatButton';
import type { Product } from '../hooks/useProducts';

const CATEGORY_PLACEHOLDER_STYLES: Record<string, { label: string; accent: string; bg: string }> = {
  eggs: { label: 'Eggs', accent: '#d97706', bg: '#fff7ed' },
  chicks: { label: 'Chicks', accent: '#ca8a04', bg: '#fefce8' },
  chicken: { label: 'Chicken', accent: '#b45309', bg: '#fff7ed' },
  poultry: { label: 'Poultry', accent: '#15803d', bg: '#f0fdf4' },
  feed: { label: 'Feed', accent: '#0f766e', bg: '#f0fdfa' },
  medicine: { label: 'Medicine', accent: '#2563eb', bg: '#eff6ff' },
  equipment: { label: 'Equipment', accent: '#475569', bg: '#f8fafc' },
  incubator: { label: 'Incubator', accent: '#0369a1', bg: '#f0f9ff' },
  default: { label: 'Product', accent: '#4b5563', bg: '#f5f5f5' },
};

const getPlaceholderStyle = (category?: string, name?: string) => {
  const source = `${category || ''} ${name || ''}`.toLowerCase();

  if (source.includes('egg')) return CATEGORY_PLACEHOLDER_STYLES.eggs;
  if (source.includes('chick')) return CATEGORY_PLACEHOLDER_STYLES.chicks;
  if (source.includes('chicken') || source.includes('hen') || source.includes('broiler')) {
    return CATEGORY_PLACEHOLDER_STYLES.chicken;
  }
  if (source.includes('medicine') || source.includes('vaccine') || source.includes('antiviral')) {
    return CATEGORY_PLACEHOLDER_STYLES.medicine;
  }
  if (source.includes('feed') || source.includes('mash')) return CATEGORY_PLACEHOLDER_STYLES.feed;
  if (source.includes('incubator')) return CATEGORY_PLACEHOLDER_STYLES.incubator;
  if (source.includes('equipment') || source.includes('cage') || source.includes('feeder')) {
    return CATEGORY_PLACEHOLDER_STYLES.equipment;
  }
  if (source.includes('poultry')) return CATEGORY_PLACEHOLDER_STYLES.poultry;

  return CATEGORY_PLACEHOLDER_STYLES.default;
};

const createCategoryPlaceholder = (category?: string, name?: string) => {
  const { label, accent, bg } = getPlaceholderStyle(category, name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <rect width="640" height="480" fill="${bg}" />
      <rect x="200" y="96" width="240" height="180" rx="28" fill="${accent}" opacity="0.14" />
      <circle cx="320" cy="186" r="54" fill="${accent}" opacity="0.2" />
      <rect x="188" y="314" width="264" height="18" rx="9" fill="${accent}" opacity="0.18" />
      <rect x="236" y="346" width="168" height="14" rx="7" fill="${accent}" opacity="0.14" />
      <text x="320" y="410" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="${accent}">
        ${label}
      </text>
      <text x="320" y="442" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">
        Image coming soon
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

interface ProductCardProps {
  product: Product;
  highlighted?: boolean;
  variant?: 'full' | 'compact';
  animationClassName?: string;
  animationDelayMs?: number;
  imageSrc: string;
  onCardClick: () => void;
  onAddToCart: (productId: string) => void | Promise<void>;
  onOrderNow: (product: Product) => void | Promise<void>;
  cardRef?: (el: HTMLDivElement | null) => void;
}

const ProductCard = ({
  product,
  highlighted = false,
  variant = 'full',
  animationClassName = '',
  animationDelayMs = 0,
  imageSrc,
  onCardClick,
  onAddToCart,
  onOrderNow,
  cardRef,
}: ProductCardProps) => {
  const minOrder = product.minimum_order_quantity || 1;
  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = !isOutOfStock && product.stock_quantity < 10;
  const vendorName = product.vendor_profiles?.farm_name || 'Verified vendor';
  const vendorLocation = product.vendor_profiles?.location || 'Location unavailable';
  const placeholderImage = createCategoryPlaceholder(product.category, product.name);
  const ratingValue = product.average_rating || 0;
  const ratingCount = product.total_ratings || 0;
  const hasRatings = ratingValue > 0 && ratingCount > 0;
  const isCompact = variant === 'compact';

  return (
    <Card
      ref={cardRef}
      className={`product-card group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl ${animationClassName} ${
        highlighted ? 'ring-4 ring-yellow-400 ring-offset-4 shadow-2xl scale-[1.02] border-yellow-400' : ''
      }`}
      style={{
        animation: highlighted ? 'pulse 2s ease-in-out' : undefined,
        transitionDelay: `${animationDelayMs}ms`,
      }}
      onClick={onCardClick}
    >
      {highlighted && (
        <div className="absolute right-3 top-3 z-20 rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-bold tracking-wide text-black shadow-md">
          ADVERTISED PRODUCT
        </div>
      )}

      <div className={`relative border-b border-stone-200 bg-[#f5f5f5] ${isCompact ? 'rounded-t-2xl' : ''}`}>
        <div className={`flex items-center justify-center p-4 ${isCompact ? 'h-[210px] sm:h-[220px]' : 'h-[200px]'}`}>
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src !== placeholderImage) {
                target.src = placeholderImage;
              }
            }}
          />
        </div>
      </div>

      <CardContent className={`flex flex-1 flex-col ${isCompact ? 'p-3' : 'p-4'}`}>
        <div className={isCompact ? 'space-y-2' : 'space-y-2.5'}>
          <div className={isCompact ? 'space-y-1' : 'space-y-1.5'}>
            <h3 className={`font-semibold leading-6 text-stone-900 ${isCompact ? 'line-clamp-1 text-[15px]' : 'line-clamp-2 min-h-[3rem] text-sm md:text-base'}`}>
              {product.name}
            </h3>
            <div className={`flex min-h-[1.25rem] items-center gap-3 ${isCompact ? 'justify-start' : 'justify-between'}`}>
              {hasRatings ? (
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-stone-700">{ratingValue.toFixed(1)}</span>
                  <span>({ratingCount})</span>
                </div>
              ) : (
                <span className="text-xs text-stone-400">No ratings yet</span>
              )}
              {!isCompact && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  {product.category || 'Product'}
                </span>
              )}
            </div>
            <div className={`flex items-start gap-3 ${isCompact ? 'flex-col' : 'justify-between'}`}>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">
                  Price
                </p>
                <p className={`font-bold leading-none text-stone-950 ${isCompact ? 'text-[1.1rem]' : 'text-xl'}`}>
                  KSH {product.price.toLocaleString()}
                </p>
              </div>
              {!isCompact && (
                isOutOfStock ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                    Out of stock
                  </span>
                ) : isLowStock ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Limited stock
                  </span>
                ) : null
              )}
            </div>
          </div>

          {!isCompact && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
              <div className="rounded-lg bg-white px-3 py-2">
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-stone-400">
                  <Package className="h-3.5 w-3.5" />
                  <span>Stock</span>
                </div>
                <span className="text-sm font-semibold text-stone-900">{product.stock_quantity}</span>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-stone-400">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Min Order</span>
                </div>
                <span className="text-sm font-semibold text-stone-900">
                  {minOrder} {product.unit || 'item'}
                </span>
              </div>
            </div>
          )}

          {isCompact ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0 space-y-2 text-[13px] text-stone-600">
                <div className="flex items-start gap-2">
                  <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <span className="line-clamp-1">{vendorName}</span>
                </div>
              </div>

              <div className="justify-self-end flex w-[118px] flex-col gap-1.5 overflow-visible transition-all duration-200 sm:-mt-6 sm:w-[44px] sm:group-hover:w-[132px]">
                <Button
                  size="sm"
                  className="h-8 w-full justify-between rounded-lg border border-green-600 bg-green-600 px-2 text-[11px] font-semibold text-white shadow-none transition-all duration-200 sm:border-transparent sm:bg-transparent sm:px-2 sm:text-green-600 sm:hover:border-green-600 sm:hover:bg-green-600 sm:hover:pr-3 sm:hover:text-white sm:group-hover:border-green-600 sm:group-hover:bg-green-600 sm:group-hover:pr-3 sm:group-hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(product.id);
                  }}
                  disabled={isOutOfStock}
                >
                  <span className="max-w-[84px] overflow-hidden whitespace-nowrap opacity-100 transition-all duration-200 sm:max-w-0 sm:opacity-0 sm:group-hover:max-w-[84px] sm:group-hover:opacity-100">
                    Add to Cart
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-white transition-colors duration-200 sm:text-green-600 sm:group-hover:text-white" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full justify-between rounded-lg border border-stone-300 bg-white px-2 text-[11px] font-semibold text-stone-900 shadow-none transition-all duration-200 sm:border-transparent sm:bg-transparent sm:px-2 sm:text-stone-800 sm:hover:border-stone-300 sm:hover:bg-white sm:hover:pr-3 sm:hover:text-stone-900 sm:group-hover:border-stone-300 sm:group-hover:bg-white sm:group-hover:pr-3 sm:group-hover:text-stone-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrderNow(product);
                  }}
                  disabled={isOutOfStock}
                >
                  <span className="max-w-[84px] overflow-hidden whitespace-nowrap opacity-100 transition-all duration-200 sm:max-w-0 sm:opacity-0 sm:group-hover:max-w-[84px] sm:group-hover:opacity-100">
                    Order Now
                  </span>
                  <ShoppingCart className="h-4 w-4 shrink-0 text-stone-700 transition-colors duration-200 sm:text-stone-700 sm:group-hover:text-stone-900" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-sm text-stone-600">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                <span className="line-clamp-1">{vendorLocation}</span>
              </div>
              <div className="flex items-start gap-2">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                <span className="line-clamp-1">{vendorName}</span>
              </div>
            </div>
          )}
        </div>

        {!isCompact && (
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <Button
              size="sm"
              className="h-11 w-full rounded-xl bg-green-600 text-sm font-semibold text-white hover:bg-green-700"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(product.id);
              }}
              disabled={isOutOfStock}
            >
              <Plus className="h-4 w-4" />
              Add to Cart
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-11 w-full rounded-xl border-stone-300 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50"
              onClick={(e) => {
                e.stopPropagation();
                onOrderNow(product);
              }}
              disabled={isOutOfStock}
            >
              <ShoppingCart className="h-4 w-4" />
              Order Now
            </Button>

            <ChatButton
              productId={product.id}
              vendorId={product.vendor_id}
              vendorUserId={product.vendor_profiles?.user_id || product.vendor_user_id}
              variant="ghost"
              className="h-10 w-full justify-start rounded-xl px-2 text-sm font-medium text-stone-600 hover:bg-transparent hover:text-stone-900"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { createCategoryPlaceholder };
export default ProductCard;
