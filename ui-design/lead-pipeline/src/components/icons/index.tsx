/**
 * Single icon seam. Screens import named icons from here, never from lucide-react
 * directly, so the underlying icon set can be swapped in one file. The Logo is a
 * tenant-tintable mark driven by the --logo token.
 */
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  File,
  Gift,
  Globe,
  Home,
  Layers,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  Workflow,
  X,
} from "lucide-react";

export {
  AlertTriangle as AlertIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  AtSign as AtIcon,
  Bell as BellIcon,
  Calendar as CalendarIcon,
  Check as CheckIcon,
  ChevronDown as ChevronIcon,
  Clock as ClockIcon,
  ExternalLink as ExternalIcon,
  File as FileIcon,
  Gift as GiftIcon,
  Globe as GlobeIcon,
  Home as HomeIcon,
  Layers as LayersIcon,
  Lock as LockIcon,
  Mail as MailIcon,
  MapPin as PinIcon,
  Pencil as EditIcon,
  Plus as PlusIcon,
  RefreshCw as RefreshIcon,
  Reply as ReplyIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Shield as ShieldIcon,
  SlidersHorizontal as SlidersIcon,
  Sparkles as SparkleIcon,
  Target as TargetIcon,
  TrendingUp as TrendIcon,
  Upload as UploadIcon,
  Users as UsersIcon,
  Workflow as FlowIcon,
  X as XIcon,
};

interface LogoProps {
  size?: number;
}

/** Placeholder diamond/portal mark, tinted with --logo. Swap per tenant. */
export function Logo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
      <path d="M12 2.4l9.6 9.6-9.6 9.6L2.4 12z" fill="var(--logo)" />
      <path d="M12 7.6l4.4 4.4-4.4 4.4L7.6 12z" fill="var(--bg-surface)" />
    </svg>
  );
}
