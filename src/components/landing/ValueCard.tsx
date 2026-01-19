import { cn } from "@/lib/utils";

interface ValueCardProps {
  title: string;
  description: string;
  accentColor?: "green" | "blue" | "purple" | "amber" | "teal";
}

const accentColorMap: Record<string, string> = {
  green: "bg-emerald-100",
  blue: "bg-blue-100",
  purple: "bg-purple-100",
  amber: "bg-amber-100",
  teal: "bg-teal-100",
};

/**
 * ValueCard - A small feature/value proposition card for the landing page.
 * Shows a colored dot indicator, title, and short description.
 */
export function ValueCard({ title, description, accentColor = "green" }: ValueCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        "bg-white rounded-xl shadow-sm border border-gray-100",
        "p-6 min-w-[160px]",
        "hover:shadow-md transition-shadow duration-200"
      )}
    >
      {/* Colored circle indicator */}
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center mb-4",
          accentColorMap[accentColor] || accentColorMap.green
        )}
      >
        <div
          className={cn(
            "w-3 h-3 rounded-full",
            accentColor === "green" && "bg-emerald-500",
            accentColor === "blue" && "bg-blue-500",
            accentColor === "purple" && "bg-purple-500",
            accentColor === "amber" && "bg-amber-500",
            accentColor === "teal" && "bg-teal-500"
          )}
        />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

export default ValueCard;
