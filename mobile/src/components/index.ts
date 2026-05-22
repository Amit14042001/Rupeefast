/**
 * RupeeFast — Component Barrels
 *
 * Single import point for all shared components.
 *
 * @example
 *   import { Button, Card, Input, Badge, TopNav, ScreenContainer, ErrorBoundary } from '../../components';
 */

// ── UI Primitives ──
export { default as Button } from './ui/Button';
export type { ButtonProps } from './ui/Button';

export { default as Card } from './ui/Card';
export type { CardProps, CardHeaderProps, CardFooterProps } from './ui/Card';

export { default as Input } from './ui/Input';
export type { InputProps } from './ui/Input';

export { default as Badge } from './ui/Badge';
export type { BadgeProps } from './ui/Badge';

export { default as ProgressBar } from './ui/ProgressBar';
export type { ProgressBarProps } from './ui/ProgressBar';

export { default as Skeleton } from './ui/Skeleton';
export type { SkeletonProps } from './ui/Skeleton';

export { default as Toast } from './ui/Toast';
export type { ToastProps, ToastOptions, ToastRef } from './ui/Toast';

export { default as LoadingOverlay } from './ui/LoadingOverlay';
export type { LoadingOverlayProps } from './ui/LoadingOverlay';

// ── Layout ──
export { default as TopNav } from './layout/TopNav';
export type { TopNavProps } from './layout/TopNav';

export { default as ScreenContainer } from './layout/ScreenContainer';
export type { ScreenContainerProps } from './layout/ScreenContainer';

// ── Error Handling ──
export { default as ErrorBoundary, useSafeAsync } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';
