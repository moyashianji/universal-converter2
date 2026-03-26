<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		url: string | null;
		fileName: string | null;
		disabled?: boolean;
		size?: 'small' | 'medium' | 'large';
		variant?: 'primary' | 'secondary';
	}

	let {
		url,
		fileName,
		disabled = false,
		size = 'medium',
		variant = 'primary'
	}: Props = $props();

	const dispatch = createEventDispatcher<{ download: void }>();

	function handleDownload() {
		if (!url || !fileName || disabled) return;

		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		a.click();

		dispatch('download');
	}
</script>

<button
	class="download-btn size-{size} variant-{variant}"
	onclick={handleDownload}
	disabled={disabled || !url || !fileName}
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<polyline points="7 10 12 15 17 10" />
		<line x1="12" y1="15" x2="12" y2="3" />
	</svg>
	<span class="label">ダウンロード</span>
</button>

<style>
	.download-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: none;
		border-radius: 0.5rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.download-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Sizes */
	.size-small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	.size-small .icon {
		width: 1rem;
		height: 1rem;
	}

	.size-medium {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
	}

	.size-medium .icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	.size-large {
		padding: 1rem 2rem;
		font-size: 1.125rem;
	}

	.size-large .icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	/* Variants */
	.variant-primary {
		background: var(--color-success);
		color: white;
	}

	.variant-primary:hover:not(:disabled) {
		background: #059669;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
	}

	.variant-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.variant-secondary:hover:not(:disabled) {
		border-color: var(--color-success);
		background: rgba(16, 185, 129, 0.1);
	}

	.icon {
		flex-shrink: 0;
	}
</style>
