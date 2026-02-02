import React from "react";

export default function ThreeColumnGrid({
  center,
  right,
}: {
  center: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">{center}</div>
        <div className="lg:col-span-4">{right}</div>
      </div>
    </div>
  );
}
