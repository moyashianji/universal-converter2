<script lang="ts">
	import type { FileCategory } from '$lib/core/types';
	import { formatFileSize } from '$lib/core/types';

	interface Props {
		file: File;
		category: FileCategory | null;
		previewUrl?: string;
	}

	let { file, category, previewUrl }: Props = $props();

	let videoRef: HTMLVideoElement | undefined = $state();
	let audioRef: HTMLAudioElement | undefined = $state();

	// Get icon based on category
	function getIcon(cat: FileCategory | null): string {
		switch (cat) {
			case 'image':
				return 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z';
			case 'video':
				return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
			case 'audio':
				return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
			case 'document':
				return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
			default:
				return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
		}
	}

	function getFileExtension(name: string): string {
		const parts = name.split('.');
		return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
	}
</script>

<div class="file-preview">
	{#if previewUrl && category === 'image'}
		<div class="preview-media">
			<img src={previewUrl} alt={file.name} class="preview-image" />
		</div>
	{:else if previewUrl && category === 'video'}
		<div class="preview-media">
			<video
				bind:this={videoRef}
				src={previewUrl}
				class="preview-video"
				controls
				muted
				playsinline
			>
				<track kind="captions" />
			</video>
		</div>
	{:else if previewUrl && category === 'audio'}
		<div class="preview-audio">
			<div class="audio-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d={getIcon('audio')} />
				</svg>
			</div>
			<audio bind:this={audioRef} src={previewUrl} class="audio-player" controls>
				<track kind="captions" />
			</audio>
		</div>
	{:else}
		<div class="preview-icon">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d={getIcon(category)} />
			</svg>
			<span class="file-ext">{getFileExtension(file.name)}</span>
		</div>
	{/if}

	<div class="file-info">
		<p class="file-name" title={file.name}>{file.name}</p>
		<div class="file-meta">
			<span class="file-size">{formatFileSize(file.size)}</span>
			{#if category}
				<span class="file-category">{category}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.file-preview {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-bg-tertiary);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.preview-media {
		width: 100%;
		max-height: 200px;
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--color-bg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.preview-image {
		max-width: 100%;
		max-height: 200px;
		object-fit: contain;
	}

	.preview-video {
		width: 100%;
		max-height: 200px;
		object-fit: contain;
		background: black;
	}

	.preview-audio {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
	}

	.audio-icon {
		width: 3rem;
		height: 3rem;
		color: var(--color-primary);
	}

	.audio-icon svg {
		width: 100%;
		height: 100%;
	}

	.audio-player {
		width: 100%;
		max-width: 300px;
	}

	.preview-icon {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		color: var(--color-primary);
	}

	.preview-icon svg {
		width: 4rem;
		height: 4rem;
	}

	.file-ext {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.file-name {
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.file-category {
		text-transform: capitalize;
	}
</style>
