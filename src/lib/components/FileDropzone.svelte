<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from './Icon.svelte';
	import { t, type Locale } from '$lib/i18n';

	interface Props {
		accept?: string;
		multiple?: boolean;
		disabled?: boolean;
		compact?: boolean;
		locale?: Locale;
	}

	let { accept = '*', multiple = true, disabled = false, compact = false, locale = 'en' }: Props = $props();

	let isDragging = $state(false);
	const dispatch = createEventDispatcher<{ files: File[] }>();

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (disabled || !e.dataTransfer) return;
		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) dispatch('files', files);
	}

	function handleChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			dispatch('files', Array.from(input.files));
			input.value = '';
		}
	}
</script>

<div
	class="dropzone"
	class:dragging={isDragging}
	class:disabled
	class:compact
	role="button"
	tabindex="0"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<input
		type="file"
		id="file-input-{compact ? 'compact' : 'main'}"
		{accept}
		{multiple}
		onchange={handleChange}
		{disabled}
		class="input"
	/>

	<label for="file-input-{compact ? 'compact' : 'main'}" class="label">
		{#if compact}
			<span class="compact-content">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
				{t(locale, 'addMore')}
			</span>
		{:else}
			<div class="icon-wrap">
				<Icon name="upload" size={28} />
			</div>
			<div class="text">
				<span class="primary">{t(locale, 'dropFiles')}</span>
				<span class="secondary">{t(locale, 'orClickToBrowse')}</span>
			</div>
			<div class="supported">
				{t(locale, 'supportsFormats')}
			</div>
		{/if}
	</label>
</div>

<style>
	.dropzone {
		position: relative;
	}

	.input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.input:disabled {
		cursor: not-allowed;
	}

	.label {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 48px 24px;
		border: 1.5px dashed var(--c-border);
		border-radius: var(--radius);
		color: var(--c-text-3);
		transition: all 0.15s;
		cursor: pointer;
	}

	.dropzone:hover:not(.disabled) .label,
	.dropzone.dragging .label {
		border-color: var(--c-accent);
		background: var(--c-accent-subtle);
		color: var(--c-text-2);
	}

	.dropzone.dragging .label {
		border-style: solid;
	}

	.dropzone.disabled .label {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon-wrap {
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--c-surface-raised);
		border-radius: 50%;
		color: var(--c-text-3);
		transition: all 0.15s;
	}

	.dropzone:hover:not(.disabled) .icon-wrap,
	.dropzone.dragging .icon-wrap {
		background: var(--c-accent-subtle);
		color: var(--c-accent);
	}

	.text {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.primary {
		font-size: 15px;
		font-weight: 550;
		color: var(--c-text);
	}

	.secondary {
		font-size: 14px;
		color: var(--c-text-2);
	}

	.supported {
		font-size: 12px;
		color: var(--c-text-3);
	}

	/* Compact */
	.compact .label {
		padding: 14px 18px;
		flex-direction: row;
	}

	.compact-content {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.label {
			padding: 36px 20px;
		}

		.icon-wrap {
			width: 48px;
			height: 48px;
		}
	}
</style>
