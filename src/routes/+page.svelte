<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Icon from '$lib/components/Icon.svelte';
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import FormatSelector from '$lib/components/FormatSelector.svelte';
	import ConversionProgress from '$lib/components/ConversionProgress.svelte';
	import LogPanel, { type LogEntry } from '$lib/components/LogPanel.svelte';
	import {
		convertFile,
		detectFileType,
		formatFileSize,
		preloadFFmpeg,
		getSystemCapabilities,
		type ConversionState,
		type FileType
	} from '$lib/converter';
	import {
		turboConvert,
		turboBatchConvert,
		turboMultiFormatConvert,
		preloadEngines,
		getEngineStatus,
		type ConversionJob
	} from '$lib/turbo-converter';
	import { getProcessingStats } from '$lib/parallel-engine';
	import {
		detectLocale,
		t,
		SUPPORTED_LOCALES,
		LOCALE_NAMES,
		type Locale
	} from '$lib/i18n';

	interface FileItem {
		file: File;
		type: FileType;
		selectedFormats: string[];
		state: ConversionState;
		results: { format: string; url: string; fileName: string; outputSize?: number }[];
	}

	let fileItems = $state<FileItem[]>([]);
	let capabilities = $state({ webcodecs: false, ffmpeg: false, sharedArrayBuffer: false });
	let mounted = $state(false);
	let isConverting = $state(false);
	let locale = $state<Locale>('en');
	let showLangMenu = $state(false);

	// Logging
	let logs = $state<LogEntry[]>([]);
	let logExpanded = $state(false);
	let logIdCounter = $state(0);
	let conversionStartTime = $state<number>(0);

	function addLog(level: LogEntry['level'], message: string, details?: Record<string, string | number>) {
		logs = [...logs, { id: logIdCounter++, timestamp: new Date(), level, message, details }];
	}

	function clearLogs() {
		logs = [];
	}

	function setLocale(newLocale: Locale) {
		locale = newLocale;
		showLangMenu = false;
		if (browser) {
			localStorage.setItem('locale', newLocale);
			// Update URL without reload
			const url = new URL(window.location.href);
			url.searchParams.set('lang', newLocale);
			window.history.replaceState({}, '', url.toString());
		}
	}

	onMount(() => {
		mounted = true;
		capabilities = getSystemCapabilities();

		// Detect locale from URL, localStorage, or browser
		const urlParams = new URLSearchParams(window.location.search);
		const urlLang = urlParams.get('lang') as Locale;
		const storedLang = localStorage.getItem('locale') as Locale;

		if (urlLang && SUPPORTED_LOCALES.includes(urlLang)) {
			locale = urlLang;
		} else if (storedLang && SUPPORTED_LOCALES.includes(storedLang)) {
			locale = storedLang;
		} else {
			locale = detectLocale();
		}

		const stats = getProcessingStats();
		addLog('info', 'Turbo engine ready', {
			cores: stats.hardwareConcurrency,
			memory: `${stats.maxMemoryMB}MB`
		});

		// Preload all engines for instant conversion
		preloadEngines()
			.then(() => {
				const status = getEngineStatus();
				addLog('success', 'Engines loaded', {
					WebCodecs: status.webcodecs ? 'OK' : 'N/A',
					FFmpeg: status.ffmpeg ? 'OK' : 'N/A',
					workers: status.workerCount
				});
			})
			.catch(() => addLog('warning', 'Engine preload partial'));
	});

	function handleFiles(event: CustomEvent<File[]>) {
		const newFiles = event.detail.map(file => {
			const type = detectFileType(file);
			addLog('info', `Added: ${file.name}`, { size: file.size });
			return {
				file,
				type,
				selectedFormats: [] as string[],
				state: { status: 'idle' as const, progress: 0, message: '', outputUrl: null, outputFileName: null },
				results: []
			};
		});
		fileItems = [...fileItems, ...newFiles];
	}

	function toggleFormat(fileIndex: number, format: string) {
		const item = fileItems[fileIndex];
		if (item.selectedFormats.includes(format)) {
			item.selectedFormats = item.selectedFormats.filter(f => f !== format);
		} else {
			item.selectedFormats = [...item.selectedFormats, format];
		}
	}

	function removeFile(index: number) {
		fileItems[index].results.forEach(r => URL.revokeObjectURL(r.url));
		if (fileItems[index].state.outputUrl) URL.revokeObjectURL(fileItems[index].state.outputUrl!);
		fileItems = fileItems.filter((_, i) => i !== index);
	}

	async function startConversion() {
		isConverting = true;
		conversionStartTime = performance.now();
		logExpanded = true;

		const stats = getProcessingStats();
		const totalFiles = fileItems.filter(item => item.selectedFormats.length > 0).length;
		const totalFormats = fileItems.reduce((sum, item) => sum + item.selectedFormats.length, 0);

		addLog('info', `Turbo conversion: ${totalFiles} files → ${totalFormats} outputs`, {
			workers: stats.hardwareConcurrency,
			maxMemory: `${stats.maxMemoryMB}MB`
		});

		// Build job list for batch processing
		const jobs: Array<{ itemIndex: number; format: string; job: ConversionJob }> = [];
		fileItems.forEach((item, itemIndex) => {
			if (item.selectedFormats.length === 0) return;
			item.state = { status: 'converting', progress: 0, message: t(locale, 'converting'), outputUrl: null, outputFileName: null };

			item.selectedFormats.forEach(format => {
				jobs.push({
					itemIndex,
					format,
					job: { file: item.file, outputFormat: format, priority: item.file.size < 10 * 1024 * 1024 ? 1 : 0 }
				});
			});
		});

		// Process all jobs in parallel using turbo engine
		let completedJobs = 0;
		const startTime = performance.now();

		await Promise.all(
			jobs.map(async ({ itemIndex, format, job }) => {
				const item = fileItems[itemIndex];
				const jobStartTime = performance.now();

				try {
					const result = await turboConvert(
						job.file,
						job.outputFormat,
						(progress, message) => {
							// Update item progress (max across all formats)
							const currentProgress = item.state.progress;
							const newProgress = Math.max(currentProgress, progress * (item.selectedFormats.indexOf(format) + 1) / item.selectedFormats.length);
							item.state = { ...item.state, progress: newProgress, message };
						}
					);

					completedJobs++;
					const elapsed = performance.now() - startTime;
					const speed = (completedJobs / jobs.length) * 100;

					if (result.success && result.blob) {
						const url = URL.createObjectURL(result.blob);
						item.results = [
							...item.results,
							{ format, url, fileName: result.fileName!, outputSize: result.stats.outputSize }
						];

						addLog('success', `${job.file.name} → .${format}`, {
							in: result.stats.inputSize,
							out: result.stats.outputSize,
							time: result.stats.duration,
							method: result.stats.method
						});
					} else {
						addLog('error', `Failed: ${job.file.name} → .${format}`, {
							error: result.error || 'Unknown'
						});
					}
				} catch (error) {
					completedJobs++;
					addLog('error', `Error: ${job.file.name} → .${format}`);
				}

				// Check if all formats for this item are done
				const itemJobs = jobs.filter(j => j.itemIndex === itemIndex);
				const itemCompleted = itemJobs.every(j => {
					return item.results.some(r => r.format === j.format) ||
						completedJobs >= jobs.length;
				});

				if (item.results.length >= item.selectedFormats.length || itemCompleted) {
					item.state = { status: 'complete', progress: 100, message: t(locale, 'complete'), outputUrl: null, outputFileName: null };
				}
			})
		);

		const totalDuration = performance.now() - conversionStartTime;
		const totalInputSize = jobs.reduce((sum, j) => sum + j.job.file.size, 0);
		const throughput = (totalInputSize / (1024 * 1024)) / (totalDuration / 1000);

		addLog('success', `Complete`, {
			totalTime: totalDuration,
			throughput: `${throughput.toFixed(1)} MB/s`,
			jobs: completedJobs
		});

		isConverting = false;
	}

	function downloadResult(result: { url: string; fileName: string }) {
		const a = document.createElement('a');
		a.href = result.url;
		a.download = result.fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadAllResults(item: FileItem) {
		item.results.forEach(downloadResult);
	}

	function reset() {
		fileItems.forEach(item => {
			item.results.forEach(r => URL.revokeObjectURL(r.url));
			if (item.state.outputUrl) URL.revokeObjectURL(item.state.outputUrl!);
		});
		fileItems = [];
		clearLogs();
	}

	let totalSelectedFormats = $derived(fileItems.reduce((sum, item) => sum + item.selectedFormats.length, 0));
	let allComplete = $derived(fileItems.length > 0 && fileItems.every(item => item.state.status === 'complete'));

	// JSON-LD structured data
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "Free Online File Converter",
		"description": "Convert video, audio, and images instantly in your browser. No upload, no registration, 100% private.",
		"url": "https://moyashianji.github.io/Pokonyan-OBSObstruction-Plugin/",
		"applicationCategory": "MultimediaApplication",
		"operatingSystem": "Any",
		"offers": {
			"@type": "Offer",
			"price": "0",
			"priceCurrency": "USD"
		},
		"featureList": [
			"Video conversion (MP4, WebM, AVI, MOV, MKV)",
			"Audio conversion (MP3, WAV, FLAC, AAC, OGG)",
			"Image conversion (PNG, JPG, WebP, GIF, BMP)",
			"No file upload required",
			"100% browser-based processing",
			"GPU-accelerated with WebCodecs API"
		]
	};
</script>

<svelte:head>
	<title>{t(locale, 'title')} - Convert Video, Audio, Images Online</title>
	<meta name="description" content={t(locale, 'metaDescription')} />
	<meta name="keywords" content="file converter, video converter, audio converter, image converter, online converter, free converter, mp4 converter, mp3 converter, png converter, webm, wav, flac, no upload, browser converter" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={t(locale, 'title')} />
	<meta property="og:description" content={t(locale, 'metaDescription')} />
	<meta property="og:url" content="https://moyashianji.github.io/Pokonyan-OBSObstruction-Plugin/" />
	<meta property="og:site_name" content="File Converter" />
	<meta property="og:locale" content={locale} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={t(locale, 'title')} />
	<meta name="twitter:description" content={t(locale, 'metaDescription')} />

	<!-- Canonical & Alternates -->
	<link rel="canonical" href="https://moyashianji.github.io/Pokonyan-OBSObstruction-Plugin/" />
	{#each SUPPORTED_LOCALES as lang}
		<link rel="alternate" hreflang={lang} href="https://moyashianji.github.io/Pokonyan-OBSObstruction-Plugin/?lang={lang}" />
	{/each}
	<link rel="alternate" hreflang="x-default" href="https://moyashianji.github.io/Pokonyan-OBSObstruction-Plugin/" />

	<!-- JSON-LD -->
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<main class="app" class:mounted>
	<!-- Language Selector -->
	<div class="lang-selector">
		<button class="lang-btn" onclick={() => showLangMenu = !showLangMenu}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
			</svg>
			{LOCALE_NAMES[locale]}
		</button>
		{#if showLangMenu}
			<div class="lang-menu">
				{#each SUPPORTED_LOCALES as lang}
					<button
						class="lang-option"
						class:active={lang === locale}
						onclick={() => setLocale(lang)}
					>
						{LOCALE_NAMES[lang]}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Hero -->
	<header class="hero">
		<h1>{t(locale, 'title')}</h1>
		<p class="hero-desc">{t(locale, 'description')}</p>
		<div class="hero-badges">
			<span class="badge"><Icon name="lock" size={14} /> {t(locale, 'secure')}</span>
			<span class="badge"><Icon name="zap" size={14} /> {t(locale, 'fast')}</span>
			<span class="badge">{t(locale, 'free')}</span>
		</div>
	</header>

	<!-- Main Converter Card -->
	<section class="converter-card">
		{#if fileItems.length === 0}
			<FileDropzone on:files={handleFiles} disabled={isConverting} />
		{:else}
			<div class="file-list">
				{#each fileItems as item, index (item.file.name + index)}
					<article class="file-card" class:complete={item.state.status === 'complete'}>
						<header class="file-header">
							<div class="file-icon">
								<Icon name={item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : 'image'} size={18} />
							</div>
							<div class="file-details">
								<h3 class="file-name">{item.file.name}</h3>
								<p class="file-meta">
									{formatFileSize(item.file.size)}
									{#if item.selectedFormats.length > 0}
										<span class="meta-arrow">→</span>
										<span class="meta-formats">{item.selectedFormats.length} {t(locale, 'selected')}</span>
									{/if}
								</p>
							</div>
							<button class="btn-close" onclick={() => removeFile(index)} disabled={isConverting}>
								<Icon name="x" size={16} />
							</button>
						</header>

						{#if item.state.status === 'complete' && item.results.length > 0}
							<div class="results-section">
								<div class="results-list">
									{#each item.results as result}
										<button class="download-btn" onclick={() => downloadResult(result)}>
											<Icon name="download" size={14} />
											.{result.fileName.split('.').pop()}
											{#if result.outputSize}
												<span class="dl-size">{formatFileSize(result.outputSize)}</span>
											{/if}
										</button>
									{/each}
								</div>
								{#if item.results.length > 1}
									<button class="download-all" onclick={() => downloadAllResults(item)}>
										{t(locale, 'downloadAll')} ({item.results.length})
									</button>
								{/if}
							</div>
						{:else if item.state.status === 'converting'}
							<div class="progress-section">
								<ConversionProgress progress={item.state.progress} status={item.state.status} message={item.state.message} />
							</div>
						{:else}
							<div class="format-section">
								<FormatSelector
									fileType={item.type}
									selectedFormats={item.selectedFormats}
									multiSelect={true}
									{locale}
									on:toggle={(e) => toggleFormat(index, e.detail)}
								/>
							</div>
						{/if}
					</article>
				{/each}
			</div>

			{#if !isConverting && !allComplete}
				<div class="add-more">
					<FileDropzone on:files={handleFiles} compact={true} {locale} />
				</div>
			{/if}

			<div class="actions">
				{#if allComplete}
					<button class="btn btn-default" onclick={reset}>{t(locale, 'startNew')}</button>
				{:else}
					<button class="btn btn-ghost" onclick={reset} disabled={isConverting}>{t(locale, 'clearAll')}</button>
					<button class="btn btn-primary" disabled={totalSelectedFormats === 0 || isConverting} onclick={startConversion}>
						{#if isConverting}
							<span class="btn-spinner"></span>
							{t(locale, 'converting')}
						{:else}
							{t(locale, 'convert')}{#if totalSelectedFormats > 0}<span class="btn-badge">{totalSelectedFormats}</span>{/if}
						{/if}
					</button>
				{/if}
			</div>

			<LogPanel {logs} bind:expanded={logExpanded} maxHeight="180px" {locale} />
		{/if}
	</section>

	<!-- How It Works -->
	<section class="how-it-works">
		<h2>{t(locale, 'howItWorks')}</h2>
		<div class="steps">
			<div class="step">
				<div class="step-num">1</div>
				<p>{t(locale, 'step1')}</p>
			</div>
			<div class="step">
				<div class="step-num">2</div>
				<p>{t(locale, 'step2')}</p>
			</div>
			<div class="step">
				<div class="step-num">3</div>
				<p>{t(locale, 'step3')}</p>
			</div>
		</div>
	</section>

	<!-- Features -->
	<section class="features">
		<h2>{t(locale, 'features')}</h2>
		<div class="feature-grid">
			<div class="feature">
				<div class="feature-icon"><Icon name="lock" size={22} /></div>
				<h3>{t(locale, 'feature1Title')}</h3>
				<p>{t(locale, 'feature1Desc')}</p>
			</div>
			<div class="feature">
				<div class="feature-icon"><Icon name="zap" size={22} /></div>
				<h3>{t(locale, 'feature2Title')}</h3>
				<p>{t(locale, 'feature2Desc')}</p>
			</div>
			<div class="feature">
				<div class="feature-icon"><Icon name="layers" size={22} /></div>
				<h3>{t(locale, 'feature3Title')}</h3>
				<p>{t(locale, 'feature3Desc')}</p>
			</div>
		</div>
	</section>

	<!-- FAQ for SEO -->
	<section class="faq">
		<h2>{t(locale, 'faq')}</h2>
		<div class="faq-list">
			<details class="faq-item">
				<summary>{t(locale, 'faq1Q')}</summary>
				<p>{t(locale, 'faq1A')}</p>
			</details>
			<details class="faq-item">
				<summary>{t(locale, 'faq2Q')}</summary>
				<p>{t(locale, 'faq2A')}</p>
			</details>
			<details class="faq-item">
				<summary>{t(locale, 'faq3Q')}</summary>
				<p>{t(locale, 'faq3A')}</p>
			</details>
		</div>
	</section>

	<!-- Footer -->
	<footer class="footer">
		<div class="footer-status">
			<span class="status-item">
				<span class="dot" class:active={capabilities.webcodecs}></span>
				WebCodecs
			</span>
			<span class="status-item">
				<span class="dot" class:active={capabilities.sharedArrayBuffer}></span>
				FFmpeg
			</span>
		</div>
		<p class="footer-note">{t(locale, 'noUpload')}</p>
	</footer>
</main>

<style>
	.app {
		max-width: 720px;
		margin: 0 auto;
		padding: 32px 20px 48px;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	.app.mounted {
		opacity: 1;
	}

	/* Language Selector */
	.lang-selector {
		position: relative;
		display: flex;
		justify-content: flex-end;
		margin-bottom: 24px;
	}

	.lang-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		font-size: 13px;
		color: var(--c-text-2);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s;
	}

	.lang-btn:hover {
		color: var(--c-text);
		border-color: var(--c-accent);
	}

	.lang-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		background: var(--c-surface-raised);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		overflow: hidden;
		z-index: 100;
	}

	.lang-option {
		display: block;
		width: 100%;
		padding: 10px 16px;
		font-size: 13px;
		text-align: left;
		color: var(--c-text-2);
		background: none;
		border: none;
		cursor: pointer;
		transition: all 0.1s;
	}

	.lang-option:hover {
		background: var(--c-surface-hover);
		color: var(--c-text);
	}

	.lang-option.active {
		color: var(--c-accent);
		background: var(--c-accent-subtle);
	}

	/* Hero */
	.hero {
		text-align: center;
		margin-bottom: 32px;
	}

	.hero h1 {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.03em;
		margin-bottom: 8px;
	}

	.hero-desc {
		font-size: 16px;
		color: var(--c-text-2);
		margin-bottom: 16px;
	}

	.hero-badges {
		display: flex;
		justify-content: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 500;
		color: var(--c-text-2);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: 20px;
	}

	/* Converter Card */
	.converter-card {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius-lg);
		padding: 24px;
		box-shadow: var(--shadow);
		margin-bottom: 48px;
	}

	/* File List */
	.file-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.file-card {
		background: var(--c-surface-raised);
		border: 1px solid var(--c-border-subtle);
		border-radius: var(--radius);
		padding: 18px;
		animation: fadeIn 0.25s ease;
	}

	.file-card.complete {
		border-color: color-mix(in srgb, var(--c-success) 30%, var(--c-border-subtle));
	}

	.file-header {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}

	.file-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--c-accent-subtle);
		color: var(--c-accent);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.file-details {
		flex: 1;
		min-width: 0;
	}

	.file-name {
		font-size: 14px;
		font-weight: 550;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 2px;
	}

	.file-meta {
		font-size: 12px;
		color: var(--c-text-3);
	}

	.meta-arrow {
		margin: 0 4px;
		color: var(--c-text-3);
	}

	.meta-formats {
		color: var(--c-accent);
	}

	.btn-close {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--c-text-3);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-close:hover:not(:disabled) {
		color: var(--c-error);
		background: var(--c-error-subtle);
	}

	.btn-close:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Sections */
	.format-section, .progress-section, .results-section {
		margin-top: 18px;
		padding-top: 18px;
		border-top: 1px solid var(--c-border-subtle);
	}

	/* Results */
	.results-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.download-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 500;
		background: var(--c-success-subtle);
		color: var(--c-success);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s;
	}

	.download-btn:hover {
		background: color-mix(in srgb, var(--c-success) 18%, transparent);
	}

	.dl-size {
		font-size: 11px;
		opacity: 0.7;
	}

	.download-all {
		font-size: 12px;
		font-weight: 500;
		color: var(--c-text-2);
		background: none;
		border: none;
		cursor: pointer;
	}

	.download-all:hover {
		color: var(--c-text);
	}

	/* Add More */
	.add-more {
		margin-top: 18px;
		padding-top: 18px;
		border-top: 1px dashed var(--c-border);
	}

	/* Actions */
	.actions {
		display: flex;
		gap: 10px;
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--c-border);
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 20px;
		font-size: 14px;
		font-weight: 550;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		flex: 1;
		background: var(--c-accent);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--c-accent-hover);
	}

	.btn-default {
		flex: 1;
		background: var(--c-surface-raised);
		color: var(--c-text);
		border: 1px solid var(--c-border);
	}

	.btn-default:hover:not(:disabled) {
		background: var(--c-surface-hover);
	}

	.btn-ghost {
		background: none;
		color: var(--c-text-2);
	}

	.btn-ghost:hover:not(:disabled) {
		color: var(--c-text);
		background: var(--c-surface-hover);
	}

	.btn-badge {
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		font-size: 11px;
		font-weight: 600;
		background: rgba(255,255,255,0.2);
		border-radius: 10px;
	}

	.btn-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255,255,255,0.25);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	/* How It Works */
	.how-it-works {
		margin-bottom: 48px;
	}

	.how-it-works h2 {
		font-size: 20px;
		font-weight: 600;
		text-align: center;
		margin-bottom: 24px;
	}

	.steps {
		display: flex;
		justify-content: center;
		gap: 32px;
		flex-wrap: wrap;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.step-num {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 600;
		color: var(--c-accent);
		background: var(--c-accent-subtle);
		border-radius: 50%;
	}

	.step p {
		font-size: 14px;
		color: var(--c-text-2);
	}

	/* Features */
	.features {
		margin-bottom: 48px;
	}

	.features h2 {
		font-size: 20px;
		font-weight: 600;
		text-align: center;
		margin-bottom: 24px;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
	}

	.feature {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		padding: 20px;
	}

	.feature-icon {
		color: var(--c-accent);
		margin-bottom: 12px;
	}

	.feature h3 {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 6px;
	}

	.feature p {
		font-size: 13px;
		color: var(--c-text-2);
		line-height: 1.5;
	}

	/* FAQ */
	.faq {
		margin-bottom: 48px;
	}

	.faq h2 {
		font-size: 20px;
		font-weight: 600;
		text-align: center;
		margin-bottom: 24px;
	}

	.faq-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.faq-item {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.faq-item summary {
		padding: 16px 20px;
		font-size: 14px;
		font-weight: 550;
		cursor: pointer;
		list-style: none;
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item summary::after {
		content: '+';
		float: right;
		font-size: 18px;
		color: var(--c-text-3);
	}

	.faq-item[open] summary::after {
		content: '−';
	}

	.faq-item p {
		padding: 0 20px 16px;
		font-size: 13px;
		color: var(--c-text-2);
		line-height: 1.6;
	}

	/* Footer */
	.footer {
		text-align: center;
	}

	.footer-status {
		display: flex;
		justify-content: center;
		gap: 16px;
		margin-bottom: 8px;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--c-text-3);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c-text-3);
		opacity: 0.4;
	}

	.dot.active {
		background: var(--c-success);
		opacity: 1;
	}

	.footer-note {
		font-size: 12px;
		color: var(--c-text-3);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Responsive */
	@media (max-width: 600px) {
		.hero h1 {
			font-size: 26px;
		}

		.converter-card {
			padding: 18px;
		}

		.file-card {
			padding: 14px;
		}

		.actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}

		.btn-ghost {
			order: 1;
		}

		.steps {
			flex-direction: column;
			align-items: center;
			gap: 16px;
		}
	}
</style>
