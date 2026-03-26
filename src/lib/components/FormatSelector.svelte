<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { getOutputFormats } from '$lib/converter';
	import { VIDEO_FORMATS, AUDIO_FORMATS, IMAGE_FORMATS, type FormatInfo } from '$lib/formats';
	import { t, type Locale } from '$lib/i18n';

	interface FormatOption {
		value: string;
		label: string;
		category: 'video' | 'audio' | 'image';
	}

	interface Props {
		selectedFormat?: string;
		selectedFormats?: string[];
		multiSelect?: boolean;
		fileType?: 'video' | 'audio' | 'image' | 'document' | null;
		locale?: Locale;
	}

	let {
		selectedFormat = '',
		selectedFormats = [],
		multiSelect = false,
		fileType = null,
		locale = 'en'
	}: Props = $props();

	const dispatch = createEventDispatcher<{ select: string; toggle: string }>();

	const allFormats: Record<string, FormatInfo> = {
		...VIDEO_FORMATS,
		...AUDIO_FORMATS,
		...IMAGE_FORMATS,
		txt: { label: 'TXT', description: 'Text', category: 'image', mimeType: 'text/plain' }
	};

	let categories = $derived({
		video: t(locale, 'video'),
		audio: t(locale, 'audio'),
		image: t(locale, 'image')
	});

	let availableFormats = $derived.by(() => {
		if (!fileType) return [];
		return getOutputFormats(fileType).map(f => ({
			value: f,
			label: allFormats[f]?.label || f.toUpperCase(),
			category: allFormats[f]?.category || 'image'
		}));
	});

	let groupedFormats = $derived.by(() => {
		const groups: Record<string, FormatOption[]> = {};
		for (const format of availableFormats) {
			if (!groups[format.category]) groups[format.category] = [];
			groups[format.category].push(format);
		}
		return Object.entries(groups).sort(([a], [b]) => {
			const order = ['video', 'audio', 'image'];
			return order.indexOf(a) - order.indexOf(b);
		});
	});

	function isSelected(value: string): boolean {
		return multiSelect ? selectedFormats.includes(value) : selectedFormat === value;
	}

	function handleClick(format: string) {
		dispatch(multiSelect ? 'toggle' : 'select', format);
	}
</script>

<div class="selector">
	<div class="selector-header">
		<span class="selector-title">{t(locale, 'outputFormats')}</span>
		{#if multiSelect && selectedFormats.length > 0}
			<span class="selected-count">{selectedFormats.length} {t(locale, 'selected')}</span>
		{/if}
	</div>

	{#if availableFormats.length === 0}
		<p class="empty">No formats available for this file type</p>
	{:else}
		{#each groupedFormats as [category, formats]}
			<div class="group">
				<div class="group-label">
					{categories[category]}
					<span class="group-count">{formats.length}</span>
				</div>
				<div class="format-grid">
					{#each formats as format}
						<button
							type="button"
							class="format-btn"
							class:selected={isSelected(format.value)}
							onclick={() => handleClick(format.value)}
						>
							{#if multiSelect && isSelected(format.value)}
								<svg class="check" width="12" height="12" viewBox="0 0 12 12" fill="none">
									<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							{/if}
							{format.label}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.selector {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.selector-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.selector-title {
		font-size: 12px;
		font-weight: 550;
		color: var(--c-text-2);
	}

	.selected-count {
		font-size: 11px;
		color: var(--c-accent);
		font-weight: 500;
	}

	.empty {
		color: var(--c-text-3);
		font-size: 13px;
		text-align: center;
		padding: 16px;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 550;
		color: var(--c-text-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.group-count {
		font-size: 10px;
		font-weight: 500;
		color: var(--c-text-3);
		opacity: 0.6;
	}

	.format-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.format-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 550;
		color: var(--c-text-2);
		background: var(--c-surface);
		border: 1px solid var(--c-border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.12s;
	}

	.format-btn:hover {
		color: var(--c-text);
		border-color: var(--c-border);
		background: var(--c-surface-hover);
	}

	.format-btn.selected {
		color: var(--c-accent);
		border-color: var(--c-accent);
		background: var(--c-accent-subtle);
	}

	.check {
		margin-left: -2px;
	}
</style>
