<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Theme, QualityPreset } from '$lib/stores/settings-store';

	interface Props {
		open?: boolean;
		theme?: Theme;
		defaultQuality?: QualityPreset;
		autoDownload?: boolean;
	}

	let {
		open = false,
		theme = 'dark',
		defaultQuality = 'high',
		autoDownload = false
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		themeChange: Theme;
		qualityChange: QualityPreset;
		autoDownloadChange: boolean;
	}>();

	const themes: { value: Theme; label: string }[] = [
		{ value: 'light', label: 'ライト' },
		{ value: 'dark', label: 'ダーク' },
		{ value: 'system', label: 'システム' },
	];

	const qualities: { value: QualityPreset; label: string }[] = [
		{ value: 'low', label: '低品質' },
		{ value: 'medium', label: '中品質' },
		{ value: 'high', label: '高品質' },
		{ value: 'lossless', label: '最高品質' },
	];

	function handleClose() {
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="settings-overlay" onclick={handleBackdropClick} role="presentation">
		<div class="settings-panel" role="dialog" aria-modal="true" aria-label="設定">
			<div class="panel-header">
				<h2 class="panel-title">設定</h2>
				<button class="close-btn" onclick={handleClose} aria-label="閉じる">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div class="panel-content">
				<div class="setting-group">
					<label class="setting-label">テーマ</label>
					<div class="setting-options">
						{#each themes as t}
							<button
								class="option-btn"
								class:selected={theme === t.value}
								onclick={() => dispatch('themeChange', t.value)}
							>
								{t.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="setting-group">
					<label class="setting-label">デフォルト品質</label>
					<div class="setting-options">
						{#each qualities as q}
							<button
								class="option-btn"
								class:selected={defaultQuality === q.value}
								onclick={() => dispatch('qualityChange', q.value)}
							>
								{q.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="setting-group">
					<label class="setting-toggle">
						<span class="toggle-label">自動ダウンロード</span>
						<input
							type="checkbox"
							checked={autoDownload}
							onchange={(e) => dispatch('autoDownloadChange', e.currentTarget.checked)}
						/>
						<span class="toggle-switch"></span>
					</label>
					<p class="setting-hint">変換完了後に自動的にダウンロードを開始します</p>
				</div>
			</div>

			<div class="panel-footer">
				<p class="footer-text">
					Universal Converter v1.0
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.settings-panel {
		background: var(--color-bg-secondary);
		border-radius: 1rem;
		border: 1px solid var(--color-border);
		width: 100%;
		max-width: 400px;
		max-height: 90vh;
		overflow: auto;
		margin: 1rem;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.panel-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.close-btn {
		width: 2rem;
		height: 2rem;
		padding: 0.25rem;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		color: var(--color-text);
		background: var(--color-bg-tertiary);
	}

	.close-btn svg {
		width: 100%;
		height: 100%;
	}

	.panel-content {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.setting-options {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.option-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-bg-tertiary);
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.option-btn:hover {
		border-color: var(--color-primary);
	}

	.option-btn.selected {
		border-color: var(--color-primary);
		background: var(--color-primary);
		color: white;
	}

	.setting-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.toggle-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		flex: 1;
	}

	.setting-toggle input {
		display: none;
	}

	.toggle-switch {
		width: 3rem;
		height: 1.5rem;
		background: var(--color-bg-tertiary);
		border-radius: 0.75rem;
		position: relative;
		transition: background 0.2s ease;
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 1.25rem;
		height: 1.25rem;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
	}

	.setting-toggle input:checked + .toggle-switch {
		background: var(--color-primary);
	}

	.setting-toggle input:checked + .toggle-switch::after {
		transform: translateX(1.5rem);
	}

	.setting-hint {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.panel-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.footer-text {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-align: center;
	}
</style>
