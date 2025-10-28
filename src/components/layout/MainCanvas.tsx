"use client";
import React from "react";

export function MainCanvas({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex-1 ml-0 md:ml-72 p-4 md:p-6 lg:p-8 overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.03)_1px,transparent_0)] [background-size:24px_24px]"
      style={{ maxWidth: "100%" }}
    >
      <div className="mx-auto max-w-[1400px] space-y-6">{children}</div>
    </main>
  );
}

export default MainCanvas;
