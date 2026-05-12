"use client";

import {
  Check, CheckCircle, BadgeCheck, ThumbsUp,
  Star, Sparkles, Award, Trophy, Crown, Flame,
  Zap, Rocket, Target, Lightbulb,
  Shield, Lock,
  Clock, Calendar,
  Heart, Gift,
  TrendingUp, TrendingDown, BarChart,
  Mail, User, Users, Briefcase, Settings, Flag, Globe,
  Play, Download, FileText,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import {
  type IconConfig,
  type IconName,
  type IconAnimation,
  normalizeIconName,
  resolveIconSizePx,
} from "@/lib/funnels/types";

const ICON_MAP: Record<IconName, LucideIcon> = {
  check: Check,
  checkCircle: CheckCircle,
  badgeCheck: BadgeCheck,
  thumbsUp: ThumbsUp,
  star: Star,
  sparkles: Sparkles,
  award: Award,
  trophy: Trophy,
  crown: Crown,
  flame: Flame,
  zap: Zap,
  rocket: Rocket,
  target: Target,
  lightbulb: Lightbulb,
  shield: Shield,
  lock: Lock,
  clock: Clock,
  calendar: Calendar,
  heart: Heart,
  gift: Gift,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  barChart: BarChart,
  mail: Mail,
  user: User,
  users: Users,
  briefcase: Briefcase,
  settings: Settings,
  flag: Flag,
  globe: Globe,
  play: Play,
  download: Download,
  fileText: FileText,
};

const ANIM_CLASS: Record<IconAnimation, string> = {
  none: "",
  pulse: "ff-icon-anim-pulse",
  bounce: "ff-icon-anim-bounce",
  spin: "ff-icon-anim-spin",
  wiggle: "ff-icon-anim-wiggle",
  float: "ff-icon-anim-float",
};

/** Récupère un composant Lucide à partir d'un nom (avec normalisation legacy). */
export function getIconComponent(name?: string): LucideIcon {
  const key = normalizeIconName(name);
  return ICON_MAP[key] ?? Check;
}

type Props = {
  config?: IconConfig;
  /** Fallback simple si pas de config (ex. ancien iconName string) */
  fallbackName?: string;
  /** Classes additionnelles (couleur, marge, etc.) */
  className?: string;
  /** Style inline additionnel */
  style?: CSSProperties;
};

/**
 * Rend une icône Lucide à partir d'une IconConfig.
 * Gère taille (px), animation (classe CSS) et couleur (style inline).
 */
export function IconRenderer({ config, fallbackName, className = "", style }: Props) {
  const name = config?.name ?? fallbackName;
  const Icon = getIconComponent(name);
  const sizePx = resolveIconSizePx(config);
  const animClass = ANIM_CLASS[config?.animation ?? "none"];
  const colorStyle: CSSProperties = config?.color ? { color: config.color } : {};

  return (
    <Icon
      width={sizePx}
      height={sizePx}
      className={`${animClass} ${className}`.trim()}
      style={{ ...colorStyle, ...style }}
      aria-hidden="true"
    />
  );
}
