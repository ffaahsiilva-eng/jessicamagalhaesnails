import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SuspenseFallbackProps {
  type?: "page" | "section" | "component";
  message?: string;
}

const SuspenseFallback = ({ type = "component", message }: SuspenseFallbackProps) => {
  if (type === "page") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-body">
            {message || "Carregando..."}
          </p>
        </div>
      </div>
    );
  }

  if (type === "section") {
    return (
      <div className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <Skeleton className="h-4 w-24 mx-auto mb-2" />
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-4 w-80 mx-auto" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
};

export default SuspenseFallback;
