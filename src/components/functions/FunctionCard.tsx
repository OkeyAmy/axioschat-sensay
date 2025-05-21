import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FunctionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const FunctionCard: React.FC<FunctionCardProps> = ({
  title,
  description,
  icon: Icon,
  children,
  className,
  contentClassName,
}) => (
  <Card 
    className={cn(
      "w-full shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/40",
      "border border-border/50 animate-in fade-in-50 slide-in-from-bottom-5",
      "backdrop-blur-sm bg-white/60 dark:bg-slate-900/60",
      className
    )}
  >
    <CardHeader className="pb-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </div>
      <CardDescription className="text-sm text-muted-foreground/90">{description}</CardDescription>
    </CardHeader>
    <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
  </Card>
);
