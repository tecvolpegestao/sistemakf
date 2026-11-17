import { Car, Droplets, Flower2, Package, Shield, Sparkles, SprayCan, Sun, Wind, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  droplets: Droplets,
  shield: Shield,
  car: Car,
  wind: Wind,
  sun: Sun,
  spray: SprayCan,
  package: Package,
  flower: Flower2,
};

export function ServiceIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
