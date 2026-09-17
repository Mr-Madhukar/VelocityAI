import { ContentSkeleton } from "~/components/shipflow/page-skeletons";

// Group-level fallback: renders inside the real shell's content area (the
// sidebar/top-nav stay mounted), so this is content-only and theme-adaptive.
// Pages with their own loading.tsx get a layout-matched skeleton instead.
export default function ProtectedLoading() {
  return <ContentSkeleton />;
}
