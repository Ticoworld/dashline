import React from "react";

export default function HelpPage() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Help & Documentation</h1>
      <p className="text-gray-400 mb-4">Find onboarding steps, FAQs, and troubleshooting tips for Dashline.</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">Getting started</h2>
        <ol className="list-decimal list-inside text-sm mt-2 text-gray-300">
          <li>Connect a contract via Dashboard → Connect or Add Dashboard.</li>
          <li>Select the project in the header project selector to populate charts.</li>
          <li>Use the time range toggle in the header to change chart ranges.</li>
        </ol>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">FAQ</h2>
        <div className="mt-2 space-y-3 text-sm text-gray-300">
          <div>
            <div className="font-medium">Why is my data missing?</div>
            <div className="text-gray-400">If you just connected a contract, data may take a few minutes to appear. Check the contract address and chain are correct.</div>
          </div>
          <div>
            <div className="font-medium">What chains are supported?</div>
            <div className="text-gray-400">We support Ethereum mainnet, Polygon, and Base for the MVP; more chains coming soon.</div>
          </div>
          <div>
            <div className="font-medium">How do I remove a project?</div>
            <div className="text-gray-400">Go to Custom Dashboards and use the Delete action on a project.</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Troubleshooting</h2>
        <ul className="list-disc list-inside text-sm mt-2 text-gray-300">
            <li>If you see &quot;Selected project is unavailable&quot;, try reconnecting or selecting another project in the header.</li>
          <li>For authentication issues, ensure you are signed in via the sign-in page.</li>
        </ul>
      </section>
    </div>
  );
}
