<script lang="ts" module>
	export interface LogEntry {
		id: number;
		timestamp: Date;
		level: 'info' | 'success' | 'warning' | 'error' | 'debug';
		message: string;
		details?: Record<string, string | number>;
	}
</script>

<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	interface Props {
		logs: LogEntry[];
		expanded?: boolean;
		maxHeight?: string;
		locale?: Locale;
	}

	let { logs = [], expanded = $bindable(false), maxHeight = '220px', locale = 'en' }: Props = $props();
	let container: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (logs.length && container) {
			container.scrollTop = container.scrollHeight;
		}
	});

	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatValue(key: string, value: string | number): string {
		if (typeof value === 'string') return value;
		if (key === 'inputSize' || key === 'outputSize' || key === 'size') {
			if (value < 1024) return `${value}B`;
			if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
			return `${(value / (1024 * 1024)).toFixed(2)}MB`;
		}
		if (key === 'time' || key === 'totalTime' || key === 'elapsed') {
			return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`;
		}
		return String(value);
	}

	const levelConfig: Record<string, { color: string; label: string }> = {
		info: { color: 'var(--c-text-3)', label: 'INFO' },
		success: { color: 'var(--c-success)', label: 'OK' },
		warning: { color: 'var(--c-warning)', label: 'WARN' },
		error: { color: 'var(--c-error)', label: 'ERR' },
		debug: { color: 'var(--c-text-3)', label: 'DBG' }
	};
</script>

<div class="log-panel">
	<button class="toggle" onclick={() => expanded = !expanded}>
		<span class="toggle-label">{t(locale, 'conversionLog')}</span>
		<span class="toggle-count">{logs.length}</span>
		<svg class="toggle-icon" class:open={expanded} width="12" height="12" viewBox="0 0 12 12" fill="none">
			<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>

	{#if expanded}
		<div class="log-content" bind:this={container} style="max-height: {maxHeight}">
			{#if logs.length === 0}
				<div class="empty">{t(locale, 'noLogs')}</div>
			{:else}
				{#each logs as log (log.id)}
					{@const config = levelConfig[log.level]}
					<div class="log-entry">
						<span class="log-time">{formatTime(log.timestamp)}</span>
						<span class="log-level" style="color: {config.color}">{config.label}</span>
						<span class="log-msg">{log.message}</span>
						{#if log.details}
							<div class="log-details">
								{#each Object.entries(log.details) as [key, value]}
									<span class="log-detail">
										<span class="detail-key">{key}</span>
										<span class="detail-val">{formatValue(key, value)}</span>
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.log-panel {
		margin-top: 18px;
		border: 1px solid var(--c-border-subtle);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--c-surface-raised);
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 14px;
		font-size: 12px;
		background: none;
		border: none;
		color: var(--c-text-2);
		cursor: pointer;
		transition: color 0.15s;
	}

	.toggle:hover {
		color: var(--c-text);
	}

	.toggle-label {
		font-weight: 550;
	}

	.toggle-count {
		font-size: 10px;
		font-weight: 600;
		color: var(--c-text-3);
		background: var(--c-surface);
		padding: 2px 6px;
		border-radius: 10px;
	}

	.toggle-icon {
		margin-left: auto;
		transition: transform 0.2s ease;
	}

	.toggle-icon.open {
		transform: rotate(180deg);
	}

	.log-content {
		overflow-y: auto;
		border-top: 1px solid var(--c-border-subtle);
		background: var(--c-bg);
	}

	.empty {
		padding: 20px;
		text-align: center;
		font-size: 12px;
		color: var(--c-text-3);
	}

	.log-entry {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: 10px;
		padding: 8px 14px;
		font-family: ui-monospace, 'SF Mono', Consolas, monospace;
		font-size: 11px;
		line-height: 1.5;
		border-bottom: 1px solid var(--c-border-subtle);
		animation: fadeIn 0.15s ease;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-time {
		color: var(--c-text-3);
		font-variant-numeric: tabular-nums;
	}

	.log-level {
		font-weight: 600;
		font-size: 10px;
		letter-spacing: 0.02em;
	}

	.log-msg {
		color: var(--c-text-2);
	}

	.log-details {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		padding-left: 90px;
		margin-top: 2px;
	}

	.log-detail {
		display: flex;
		gap: 4px;
		font-size: 10px;
	}

	.detail-key {
		color: var(--c-text-3);
	}

	.detail-val {
		color: var(--c-accent);
		font-weight: 500;
	}

	/* Scrollbar */
	.log-content::-webkit-scrollbar {
		width: 8px;
	}

	.log-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.log-content::-webkit-scrollbar-thumb {
		background: var(--c-border);
		border-radius: 4px;
	}
</style>
