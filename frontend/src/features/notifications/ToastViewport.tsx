import { ToastList } from '@/components/organisms/ToastList';
import { useToasts } from './ToastContext';

export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  return <ToastList toasts={toasts} onDismiss={dismiss} />;
}
