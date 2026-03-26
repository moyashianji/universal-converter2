<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		quality?: 'low' | 'medium' | 'high' | 'lossless';
		disabled?: boolean;
	}

	let { quality = 'high', disabled = false }: Props = $props();

	const dispatch = createEventDispatcher<{ change: 'low' | 'medium' | 'high' | 'lossless' }>();

	const options = [
		{ value: 'low', label: '低', description: 'ファイルサイズ小' },
		{ value: 'medium', label: '中', description: 'バランス' },
		{ value: 'high', label: '高', description: '高品質' },
		{ value: 'lossless', label: '最高', description: '劣化なし' },
	] as const;

	function selectQuality(value: 'low' | 'medium' | 'high' | 'lossless') {
		if (!disabled) {
			dispatch('change', value);
		}
	}
</script>

<div class="quality-selector" class:disabled>
	<label class="selector-label">品質設定</label>
	<div class="options">
		{#each options as option}
			<button
				class="option"
				class:selected={quality === option.value}
				onclick={() => selectQuality(option.value)}
				{disabled}
				type="button"
			>
				<span class="option-label">{option.label}</span>
				<span class="option-desc">{option.description}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.quality-selector {
		width: 100%;
	}

	.quality-selector.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.selector-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	.option {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-bg-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.option:hover:not(:disabled) {
		border-color: var(--color-primary);
		background: rgba(99, 102, 241, 0.1);
	}

	.option.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
	}

	.option-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.option.selected .option-label {
		color: white;
	}

	.option-desc {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.option.selected .option-desc {
		color: rgba(255, 255, 255, 0.8);
	}

	@media (max-width: 480px) {
		.options {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
