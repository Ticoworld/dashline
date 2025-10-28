"use client";
import React from "react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-white p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
  <p className="text-sm text-gray-400">The page you requested doesn&apos;t exist. Try using the navigation or go back to the dashboard.</p>
      </div>
    </div>
  );
}
