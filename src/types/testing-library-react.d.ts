declare module '@testing-library/react' {
	// Minimal type stubs for typechecking tests without installing the package
	import * as React from 'react';
	export function render(ui: React.ReactElement, options?: unknown): { rerender: (ui: React.ReactElement) => void; unmount: () => void };
	export const screen: {
		getByText: (text: RegExp | string) => HTMLElement;
		queryByText: (text: RegExp | string) => HTMLElement | null;
		getByRole: (role: string, options?: unknown) => HTMLElement;
	};
}
