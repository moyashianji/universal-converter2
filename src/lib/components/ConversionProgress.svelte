<script lang="ts">
	interface Props {
		progress: number;
		status: 'idle' | 'loading' | 'converting' | 'complete' | 'error';
		message?: string;
	}

	let { progress = 0, status = 'idle', message = '' }: Props = $props();
	let displayProgress = $derived(Math.min(Math.max(Math.round(progress), 0), 100));
</script>

<div class="progress">
	<div class="indicator" class:active={status === 'converting' || status === 'loading'}>
		{#if status === 'converting' || status === 'loading'}
			<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<circle cx="12" cy="12" r="10" stroke-opacity="0.2" />
				<path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
			</svg>
		{:else if status === 'complete'}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		{:else if status === 'error'}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
				<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
				<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
			</svg>
		{/if}
	</div>

	<div class="content">
		<div class="top">
			<span class="message">{message || 'Processing...'}</span>
			<span class="percent">{displayProgress}%</span>
		</div>
		<div class="bar">
			<div
				class="fill"
				class:complete={status === 'complete'}
				class:error={status === 'error'}
				style="width: {displayProgress}%"
			>
				{#if status === 'converting' || status === 'loading'}
					<div class="shimmer"></div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.progress {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.indicator {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--c-surface);
		border-radius: 50%;
		color: var(--c-text-3);
		transition: all 0.2s;
	}

	.indicator.active {
		background: var(--c-accent-subtle);
		color: var(--c-accent);
	}

	.indicator svg {
		width: 18px;
		height: 18px;
	}

	.spinner {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.content {
		flex: 1;
		min-width: 0;
	}

	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
	}

	.message {
		font-size: 13px;
		color: var(--c-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.percent {
		font-size: 13px;
		font-weight: 600;
		color: var(--c-accent);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 6px;
		background: var(--c-border);
		border-radius: 3px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--c-accent);
		border-radius: 3px;
		transition: width 0.25s ease;
		position: relative;
		overflow: hidden;
	}

	.fill.complete {
		background: var(--c-success);
	}

	.fill.error {
		background: var(--c-error);
	}

	.shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
		animation: shimmer 1.2s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}
</style>
