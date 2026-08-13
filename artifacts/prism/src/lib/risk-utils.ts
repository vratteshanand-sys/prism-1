export const getRiskColor = (score: number) => {
  if (score >= 80) return "text-red-600 dark:text-red-400";
  if (score >= 40) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-500 dark:text-emerald-400";
};

export const getRiskBgColor = (score: number) => {
  if (score >= 80) return "bg-red-600";
  if (score >= 40) return "bg-amber-500";
  return "bg-emerald-500";
};

export const getRiskBadgeVariant = (score: number): "critical" | "warning" | "success" => {
  if (score >= 80) return "critical";
  if (score >= 40) return "warning";
  return "success";
};
