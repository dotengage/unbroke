import {
  Utensils, ShoppingBasket, ShoppingBag, Car, Plane, Receipt, Home, Clapperboard, Repeat, HeartPulse, Sparkles, GraduationCap,
  Gift, CircleEllipsis, Banknote, Landmark, CreditCard, Wallet, Smartphone, Coffee, Pizza, Fuel, Bus, Train, Shirt, Gamepad2,
  Music, Dumbbell, PawPrint, Baby, Wrench, Wifi, Zap, Droplet, Book, Briefcase, Hotel, Pill, Stethoscope, Scissors, Cigarette,
  Beer, Wine, Popcorn, Tv, Laptop, Phone, Bike, PiggyBank, Landmark as Bank, Building2, Package, Flower2, Sofa, Hammer, Baby as Kid,
  Tag, TrendingUp, TrendingDown, CalendarDays, Sun, ArrowUpRight, ArrowDownRight, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-basket': ShoppingBasket, 'shopping-bag': ShoppingBag, car: Car, plane: Plane, receipt: Receipt,
  home: Home, clapperboard: Clapperboard, repeat: Repeat, 'heart-pulse': HeartPulse, sparkles: Sparkles, 'graduation-cap': GraduationCap,
  gift: Gift, 'circle-ellipsis': CircleEllipsis, banknote: Banknote, landmark: Landmark, 'credit-card': CreditCard, wallet: Wallet,
  smartphone: Smartphone, coffee: Coffee, pizza: Pizza, fuel: Fuel, bus: Bus, train: Train, shirt: Shirt, gamepad: Gamepad2, music: Music,
  dumbbell: Dumbbell, paw: PawPrint, baby: Baby, wrench: Wrench, wifi: Wifi, zap: Zap, droplet: Droplet, book: Book, briefcase: Briefcase,
  hotel: Hotel, pill: Pill, stethoscope: Stethoscope, scissors: Scissors, cigarette: Cigarette, beer: Beer, wine: Wine, popcorn: Popcorn,
  tv: Tv, laptop: Laptop, phone: Phone, bike: Bike, 'piggy-bank': PiggyBank, bank: Bank, building: Building2, package: Package,
  flower: Flower2, sofa: Sofa, hammer: Hammer, kid: Kid, tag: Tag,
  // insight icons
  'trending-up': TrendingUp, 'trending-down': TrendingDown, 'calendar-days': CalendarDays, sun: Sun, 'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
};

export const PICKABLE_ICONS = Object.keys(ICONS).filter((k) => !['trending-up', 'trending-down', 'calendar-days', 'sun', 'arrow-up-right', 'arrow-down-right', 'bank', 'kid'].includes(k));

export const ACCOUNT_TYPE_ICON: Record<string, string> = { cash: 'banknote', bank: 'landmark', card: 'credit-card', wallet: 'wallet', upi: 'smartphone', other: 'piggy-bank' };

// Categorical palette (validated set, fixed order) + neutral
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#8e8e93'];

// keyword → icon, first match wins (more specific words first)
const ICON_HINTS: [string, string[]][] = [
  ['coffee', ['coffee', 'cafe', 'café', 'tea', 'chai', 'starbucks']],
  ['pizza', ['pizza', 'fast food', 'snack', 'burger', 'dominos']],
  ['scissors', ['salon', 'haircut', 'grooming', 'barber']],
  ['beer', ['beer', 'bar', 'pub', 'alcohol', 'drinks', 'party', 'liquor']],
  ['wine', ['wine']],
  ['utensils', ['food', 'dining', 'lunch', 'dinner', 'breakfast', 'restaurant', 'eat', 'meal', 'swiggy', 'zomato', 'canteen', 'mess']],
  ['shopping-basket', ['grocer', 'vegetable', 'fruit', 'milk', 'kirana', 'blinkit', 'zepto', 'bigbasket', 'supermarket']],
  ['shirt', ['cloth', 'fashion', 'apparel', 'shoe', 'myntra', 'dress']],
  ['shopping-bag', ['shop', 'amazon', 'flipkart', 'mall', 'purchase']],
  ['fuel', ['fuel', 'petrol', 'diesel', 'cng']],
  ['bus', ['bus']],
  ['train', ['train', 'metro', 'rail', 'irctc']],
  ['bike', ['bike', 'cycle', 'scooter', 'rapido']],
  ['car', ['car', 'cab', 'taxi', 'uber', 'ola', 'transport', 'commute', 'parking', 'toll', 'auto']],
  ['hotel', ['hotel', 'stay', 'airbnb', 'hostel']],
  ['plane', ['travel', 'flight', 'trip', 'vacation', 'holiday', 'tour']],
  ['zap', ['electric', 'power', 'light bill']],
  ['droplet', ['water']],
  ['wifi', ['internet', 'wifi', 'broadband']],
  ['phone', ['phone', 'mobile', 'recharge', 'jio', 'airtel']],
  ['receipt', ['bill', 'utilit', 'tax', 'fee', 'fine']],
  ['sofa', ['furniture', 'decor', 'interior']],
  ['wrench', ['repair', 'maintenance', 'service', 'mechanic']],
  ['home', ['rent', 'house', 'home', 'housing', 'flat']],
  ['tv', ['netflix', 'prime', 'hotstar', 'ott', 'streaming', 'tv']],
  ['music', ['music', 'spotify', 'concert']],
  ['repeat', ['subscription', 'recurring', 'membership']],
  ['popcorn', ['popcorn']],
  ['clapperboard', ['movie', 'cinema', 'film', 'entertainment', 'show']],
  ['gamepad', ['game', 'gaming', 'playstation', 'xbox', 'steam']],
  ['dumbbell', ['gym', 'fitness', 'sport', 'workout', 'yoga']],
  ['pill', ['medicine', 'pharmacy', 'chemist', 'tablet']],
  ['stethoscope', ['doctor', 'hospital', 'clinic', 'medical', 'dental']],
  ['heart-pulse', ['health', 'wellness', 'insurance']],
  ['sparkles', ['beauty', 'personal care', 'cosmetic', 'skincare', 'spa']],
  ['graduation-cap', ['education', 'school', 'college', 'course', 'tuition', 'class', 'exam']],
  ['book', ['book', 'stationery', 'kindle']],
  ['laptop', ['tech', 'electronic', 'gadget', 'software', 'computer', 'laptop']],
  ['gift', ['gift', 'donation', 'charity', 'present']],
  ['paw', ['pet', 'dog', 'cat', 'vet']],
  ['baby', ['baby', 'kid', 'child', 'diaper']],
  ['cigarette', ['smok', 'cigarette']],
  ['briefcase', ['work', 'office', 'business']],
  ['credit-card', ['emi', 'loan', 'credit', 'card']],
  ['piggy-bank', ['saving', 'invest', 'sip', 'mutual']],
  ['flower', ['flower', 'plant', 'garden']],
  ['package', ['delivery', 'courier', 'parcel']],
  ['smartphone', ['upi', 'paytm', 'phonepe', 'gpay', 'google pay']],
  ['wallet', ['wallet', 'amazon pay']],
  ['banknote', ['cash']],
  ['landmark', ['bank', 'hdfc', 'sbi', 'icici', 'axis', 'kotak', 'savings', 'account']],
];

export function suggestIcon(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (n.length < 2) return null;
  // match at word starts so 'eat' doesn't fire on 'theatre'
  for (const [icon, words] of ICON_HINTS) if (words.some((w) => new RegExp('(^|[^a-z])' + w).test(n))) return icon;
  return null;
}

/** Guesses the account type from its name, e.g. "SBI Savings" → bank, "PhonePe" → upi. */
export function suggestAccountType(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (/cash/.test(n)) return 'cash';
  if (/credit|card|amex|visa|mastercard|rupay/.test(n)) return 'card';
  if (/upi|paytm|phonepe|gpay|google pay|bhim/.test(n)) return 'upi';
  if (/wallet|amazon pay|mobikwik|freecharge/.test(n)) return 'wallet';
  if (/bank|hdfc|sbi|icici|axis|kotak|yes|idfc|pnb|bob|canara|savings|salary|current/.test(n)) return 'bank';
  return null;
}

export function Icon({ name, size = 20, strokeWidth = 2, className }: { name: string; size?: number; strokeWidth?: number; className?: string }) {
  const C = ICONS[name] || Tag;
  return <C size={size} strokeWidth={strokeWidth} className={className} />;
}

/** Colored rounded tile with an icon, the visual identity of a category/account. */
export function IconTile({ icon, color, size = 'md' }: { icon: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const c = color || '#8e8e93';
  const px = size === 'sm' ? 16 : size === 'lg' ? 26 : 20;
  return (
    <span className={`icon-tile ${size === 'md' ? '' : size}`} style={{ background: hexA(c, 0.16), color: c }}>
      <Icon name={icon} size={px} />
    </span>
  );
}

export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(142,142,147,${a})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
