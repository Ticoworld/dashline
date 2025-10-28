"use client";
import React, { useEffect, useState } from "react";
import { api } from "@/lib/trpc";

export default function SettingsPage() {
  const { data, isLoading, refetch } = api.user.getSettings.useQuery();
  const update = api.user.updateSettings.useMutation({ onSuccess: () => refetch() });

  const [theme, setTheme] = useState<string>("dark");
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);
  const [weeklyDigest, setWeeklyDigest] = useState<boolean>(true);

  useEffect(() => {
    if (data?.settings) {
      setTheme(data.settings.theme ?? "dark");
      setEmailNotifications(Boolean(data.settings.emailNotifications ?? true));
      setWeeklyDigest(Boolean(data.settings.weeklyDigest ?? true));
    }
  }, [data]);

  function handleSave() {
    update.mutate({ settings: { theme, emailNotifications, weeklyDigest } });
  }

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300">Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="p-2 bg-[#0b0b0b] rounded mt-1">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Email notifications</div>
            <div className="text-xs text-gray-400">Receive alerts and updates via email</div>
          </div>
          <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Weekly digest</div>
            <div className="text-xs text-gray-400">Summarized activity delivered weekly</div>
          </div>
          <input type="checkbox" checked={weeklyDigest} onChange={(e) => setWeeklyDigest(e.target.checked)} />
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={update.status === 'pending'} className="px-4 py-2 bg-[#6366F1] rounded text-white">{update.status === 'pending' ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
