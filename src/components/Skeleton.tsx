import React from "react";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export function Skeleton({ className = "", style = {}, width, height, circle }: SkeletonProps) {
  const combinedStyle: React.CSSProperties = {
    ...style,
    width: width ?? style.width,
    height: height ?? style.height,
    borderRadius: circle ? "50%" : style.borderRadius,
  };

  return (
    <div 
      className={`skeleton ${className}`} 
      style={combinedStyle}
    />
  );
}

export function SkeletonCard({ children, className = "" }: { children?: React.ReactNode, className?: string }) {
  return (
    <div className={`card glass-card ${className}`} style={{ padding: 20 }}>
      {children}
    </div>
  );
}
