<script lang="ts">
  import { tick } from 'svelte';
  import { 
    vectorize, 
    loadImage, 
    downloadSvg,
    type VectorizeOptions  } from '../lib/vectorizer';

  let file: File | null = $state(null);
  let imageData: ImageData | null = $state(null);
  let svgContent: string | null = $state(null);
  let processing = $state(false);
  let progressValue = $state(0);
  let error: string | null = $state(null);
  let isDragging = $state(false);
  
  let imageWidth = $state(0);
  let imageHeight = $state(0);
  
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let svgContainerEl: HTMLDivElement | undefined = $state();

  let clusteringMode: 'color' | 'binary' = $state('color');
  let hierarchical: 'stacked' | 'cutout' = $state('stacked');
  let pathMode: 'spline' | 'polygon' | 'none' = $state('spline');
  
  let filterSpeckle = $state(4);
  let colorPrecision = $state(6);
  let layerDifference = $state(16);
  let cornerThreshold = $state(60);
  let lengthThreshold = $state(4.0);
  let spliceThreshold = $state(45);
  let pathPrecision = $state(8);

  let showColorOptions = $derived(clusteringMode === 'color');
  let showSplineOptions = $derived(pathMode === 'spline');
  let hasImage = $derived(imageData !== null);

  let canvasOpacity = $state(1);

  let showMobileControls = $state(false);
  let activeTooltip: string | null = $state(null);

  const tooltipCopy: Record<string, string> = {
    clustering: 'Decide if vtracer keeps the original colors or flattens the image to black and white layers.',
    filterSpeckle: 'Removes tiny dots/noise. Higher values skip more small shapes for a cleaner result.',
    colorPrecision: 'Controls how many color shades are grouped together. Lower numbers keep more colors; higher numbers give a flatter poster look.',
    layerDifference: 'Sets how sensitive the tracer is to soft gradients. Lower values keep subtle shading, higher values flatten it.',
    curveFitting: 'Choose how paths are drawn: Pixel keeps blocky edges, Polygon uses straight segments, Spline smooths curves.',
    cornerThreshold: 'Angles sharper than this remain corners. Lower values keep more corners; higher values smooth them out.',
    lengthThreshold: 'Shortest line segment that will be preserved. Larger numbers remove tiny wiggles.',
    spliceThreshold: 'How eagerly paths merge when lines meet. Higher values join more paths into single shapes.'
  };
  const tooltipButtonClass = 'w-5 h-5 text-[10px] font-semibold italic rounded-full border border-emerald-700 text-emerald-300 flex items-center justify-center hover:bg-emerald-900/40';

  function toggleTooltip(id: string) {
    activeTooltip = activeTooltip === id ? null : id;
  }

  function resetImage() {
    file = null;
    imageData = null;
    svgContent = null;
    error = null;
    progressValue = 0;
    canvasOpacity = 1;
    isDragging = false;

    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
    }

    if (svgContainerEl) {
      svgContainerEl.innerHTML = '';
    }
  }

  async function handleFile(f: File) {
    if (!f.type.startsWith('image/')) {
      error = 'Please select an image file';
      return;
    }
    error = null;
    file = f;
    svgContent = null;

    try {
      imageData = await loadImage(f);
      imageWidth = imageData.width;
      imageHeight = imageData.height;
      
      await new Promise(r => setTimeout(r, 0));
      if (canvasEl) {
        canvasEl.width = imageWidth;
        canvasEl.height = imageHeight;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          ctx.putImageData(imageData, 0, 0);
        }
      }
      
      await processImage();
    } catch (e) {
      error = `Failed to load image: ${e}`;
    }
  }

  async function processImage() {
    if (!imageData) return;
    if (processing) {
      return;
    }
    processing = true;
    progressValue = 0;
    canvasOpacity = 1;
    error = null;
    svgContent = null;

    if (svgContainerEl) {
      svgContainerEl.innerHTML = '';
    }

    await tick();
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    try {
      const options: VectorizeOptions = {
        colormode: clusteringMode === 'binary' ? 'bw' : 'color',
        mode: pathMode === 'none' ? 'pixel' : pathMode,
        hierarchical,
        filter_speckle: filterSpeckle * filterSpeckle,
        color_precision: 8 - colorPrecision,
        layer_difference: layerDifference,
        corner_threshold: cornerThreshold * Math.PI / 180,
        length_threshold: lengthThreshold,
        splice_threshold: spliceThreshold * Math.PI / 180,
        path_precision: pathPrecision,
      };
      
      const result = await vectorize(imageData, options, (stage, value) => {
        progressValue = value * 100;
        if (progressValue >= 50) {
          canvasOpacity = 0;
        } else {
          canvasOpacity = (50 - progressValue) / 25;
        }
      });
      
      svgContent = result.svg;
      
      if (svgContainerEl) {
        svgContainerEl.innerHTML = result.svg;
        const svgEl = svgContainerEl.querySelector('svg');
        if (svgEl) {
          svgEl.setAttribute('id', 'svg-output');
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svgEl.style.position = 'absolute';
          svgEl.style.width = '100%';
          svgEl.style.height = '100%';
          svgEl.style.top = '0';
          svgEl.style.left = '0';
          if (clusteringMode === 'binary') {
            svgEl.style.background = '#fff';
          }
        } else {
          console.error('[App] No SVG element found after innerHTML injection');
        }
      }
      
      progressValue = 100;
    } catch (e) {
      console.error('[App] Processing error:', e);
      error = `Processing failed: ${e}`;
    } finally {
      processing = false;
    }
  }

  function handleDownload() {
    if (svgContent) {
      const filename = file?.name.replace(/\.[^.]+$/, '.svg') || 'export.svg';
      downloadSvg(svgContent, filename);
    }
  }

  function handleDragOver(e: DragEvent) { 
    e.preventDefault(); 
    isDragging = true; 
  }
  
  function handleDragLeave(e: DragEvent) { 
    e.preventDefault();
    isDragging = false; 
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const f = e.dataTransfer?.files[0];
    if (f) handleFile(f);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) handleFile(f);
  }
  
  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleFile(blob);
        }
        e.preventDefault();
        break;
      }
    }
  }

  
  $effect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  });
  </script>

<div class="min-h-screen bg-transparent text-gray-100 flex flex-col lg:flex-row">
  <main class="flex-1 min-h-screen relative order-1 lg:order-2">
    <div class="lg:hidden flex items-center justify-between px-4 pt-4">
      <div class="flex items-center gap-2">
        <img 
          src="/vtracer-wasm/VTRacer-WASM-Square.svg" 
          alt="VTracer WASM" 
          class="h-10 w-auto rounded-sm object-contain"
          loading="lazy"
        />
        <span class="text-lg font-semibold text-[#188F54]">VTRACER WASM</span>
      </div>
      <button
        type="button"
        onclick={() => showMobileControls = true}
        class="inline-flex items-center gap-2 rounded-md border border-emerald-700 bg-black/60 px-3 py-1.5 text-xs font-medium text-emerald-300 shadow-sm hover:bg-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-black"
      >
        <span>Controls</span>
      </button>
    </div>

    {#if processing}
      <div class="absolute top-0 left-0 right-0 z-50 bg-black/60 h-2">
        <div class="h-full bg-emerald-500 transition-all duration-100" style="width: {progressValue}%"></div>
      </div>
      <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50 border border-emerald-700/60">
        Processing... {Math.round(progressValue)}%
      </div>
    {/if}

    <div 
      class="h-full flex flex-col items-center justify-center p-4 md:p-8 gap-4"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      role="application"
    >
      {#if !hasImage}
        <div 
          id="droptext"
          class="w-full max-w-xl aspect-video flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors p-8 {isDragging ? 'border-sky-400 bg-sky-400/10' : 'border-slate-600'}"
        >
          <img 
            src="/vtracer-wasm/VTRacer-WASM-Full.svg" 
            alt="VTracer WASM" 
            class="max-w-xs my-4 opacity-30 rounded-md object-contain"
            loading="lazy"
          />
          <p class="text-slate-400 text-lg mt-4 text-center px-4">
            Drag an image here, <kbd class="px-1.5 py-0.5 bg-slate-700 rounded text-xs">⌘V</kbd> or <kbd class="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Ctrl+C</kbd> to paste, or 
            <label class="text-[#188F54] hover:text-[#95DB50] cursor-pointer underline">
              Select file
              <input type="file" accept="image/*" class="hidden" onchange={handleFileInput} />
            </label>
          </p>
        </div>
      {:else}
        <div 
          id="canvas-container" 
          class="relative max-w-full max-h-full"
          style="aspect-ratio: {imageWidth}/{imageHeight}; width: min(100%, calc(100vh - 4rem) * {imageWidth}/{imageHeight});"
        >
          <canvas 
            bind:this={canvasEl}
            id="frame"
            class="absolute inset-0 w-full h-full object-contain"
            style="opacity: {canvasOpacity}; display: {clusteringMode !== 'binary' ? 'block' : 'none'};"
          ></canvas>
          
          <div 
            bind:this={svgContainerEl}
            id="svg-container"
            class="absolute inset-0 w-full h-full z-10"
          ></div>
        </div>
      {/if}

      <div class="w-full max-w-xl lg:hidden flex gap-2">
        <button 
          onclick={processImage} 
          disabled={!imageData || processing}
          class="flex-1 py-2 px-4 bg-[#188F54] hover:bg-[#95DB50] disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {#if processing}
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          {:else}
            Vectorize
          {/if}
        </button>
        <button 
          onclick={handleDownload} 
          disabled={!svgContent}
          class="flex-1 py-2 px-4 {svgContent ? 'bg-[#188F54] hover:bg-[#95DB50]' : 'bg-slate-700'} disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
        >
          {svgContent ? 'Download SVG' : 'Download'}
        </button>
      </div>
    </div>
  </main>

  {#if showMobileControls}
    <div 
      class="fixed inset-0 z-30 bg-black/60 lg:hidden"
      role="button"
      tabindex="0"
      onclick={() => showMobileControls = false}
      onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') showMobileControls = false; }}
    ></div>
  {/if}

  <aside 
    class="fixed inset-y-0 right-0 z-40 w-80 max-w-full bg-black/90 border-l border-emerald-800 overflow-y-auto transform transition-transform duration-200 lg:static lg:w-96 lg:shrink-0 lg:bg-black/70 lg:border-r lg:border-l-0 lg:h-auto lg:translate-x-0 lg:overflow-visible backdrop-blur-sm order-2 lg:order-1"
    class:translate-x-0={showMobileControls}
    class:translate-x-full={!showMobileControls}
  >
    <div class="px-4 py-5 lg:px-6 lg:py-6 h-full md:flex md:flex-col md:justify-center">
      <div class="mb-4 pb-3 border-b border-slate-700">
        <div class="flex flex-col items-center gap-3 mb-1">
          <img 
            src="/vtracer-wasm/VTRacer-WASM-Square.svg" 
            alt="VTracer WASM" 
            class="h-16 w-auto rounded-sm object-contain"
            loading="lazy"
          />
          <h1 class="text-2xl text-center font-bold text-[#188F54]">VTRACER WASM</h1>
        </div>
      </div>

      <div class="hidden lg:flex mb-4 gap-2">
        <button 
          onclick={processImage} 
          disabled={!imageData || processing}
          class="flex-1 py-2 px-4 bg-[#188F54] hover:bg-[#95DB50] disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {#if processing}
            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          {:else}
            Vectorize
          {/if}
        </button>
        <button 
          onclick={handleDownload} 
          disabled={!svgContent}
          class="flex-1 py-2.5 px-4 {svgContent ? 'bg-[#188F54] hover:bg-[#95DB50]' : 'bg-slate-700'} disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded transition-colors"
        >
          {svgContent ? '✓ Download SVG' : 'Download'}
        </button>
      </div>

      <div class="mb-4">
        <div class="text-slate-400 mb-2 text-sm font-medium flex items-center gap-2 relative">
          <span>Clustering</span>
          <button
            type="button"
            aria-label="What does clustering do?"
            aria-expanded={activeTooltip === 'clustering'}
            aria-controls="tip-clustering"
            onclick={() => toggleTooltip('clustering')}
            class={tooltipButtonClass}
          >i
          </button>
          {#if activeTooltip === 'clustering'}
            <div id="tip-clustering" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
              {tooltipCopy.clustering}
            </div>
          {/if}
        </div>
        
        <div class="flex gap-1 mb-2">
          <button 
            class="flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors {clusteringMode === 'binary' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => clusteringMode = 'binary'}
          >B/W</button>
          <button 
            class="flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors {clusteringMode === 'color' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => clusteringMode = 'color'}
          >Color</button>
        </div>
        
        <div class="flex gap-1">
          <button 
            class="flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors {hierarchical === 'cutout' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => hierarchical = 'cutout'}
          >Cutout</button>
          <button 
            class="flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors {hierarchical === 'stacked' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => hierarchical = 'stacked'}
          >Stacked</button>
        </div>
      </div>

      <div class="mb-3">
        <div class="flex justify-between text-slate-400 text-sm mb-1">
          <div class="flex items-center gap-2 relative">
            <span>Filter Speckle</span>
            <button
              type="button"
              aria-label="What does Filter Speckle do?"
              aria-expanded={activeTooltip === 'filterSpeckle'}
              aria-controls="tip-filterSpeckle"
              onclick={() => toggleTooltip('filterSpeckle')}
              class={tooltipButtonClass}
            >i
            </button>
            {#if activeTooltip === 'filterSpeckle'}
              <div id="tip-filterSpeckle" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
                {tooltipCopy.filterSpeckle}
              </div>
            {/if}
          </div>
          <span class="font-mono text-slate-300">{filterSpeckle}</span>
        </div>
        <input type="range" min="1" max="16" step="1" bind:value={filterSpeckle} class="w-full" />
      </div>

      {#if showColorOptions}
        <div class="mb-3">
          <div class="flex justify-between text-slate-400 text-sm mb-1">
            <div class="flex items-center gap-2 relative">
              <span>Color Precision</span>
              <button
                type="button"
                aria-label="What does Color Precision do?"
                aria-expanded={activeTooltip === 'colorPrecision'}
                aria-controls="tip-colorPrecision"
                onclick={() => toggleTooltip('colorPrecision')}
                class={tooltipButtonClass}
              >i
              </button>
              {#if activeTooltip === 'colorPrecision'}
                <div id="tip-colorPrecision" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
                  {tooltipCopy.colorPrecision}
                </div>
              {/if}
            </div>
            <span class="font-mono text-slate-300">{colorPrecision}</span>
          </div>
          <input type="range" min="1" max="8" step="1" bind:value={colorPrecision} class="w-full" />
        </div>

        <div class="mb-4">
          <div class="flex justify-between text-slate-400 text-sm mb-1">
            <div class="flex items-center gap-2 relative">
              <span>Gradient Step</span>
              <button
                type="button"
                aria-label="What does Gradient Step do?"
                aria-expanded={activeTooltip === 'layerDifference'}
                aria-controls="tip-layerDifference"
                onclick={() => toggleTooltip('layerDifference')}
                class={tooltipButtonClass}
              >i
              </button>
              {#if activeTooltip === 'layerDifference'}
                <div id="tip-layerDifference" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
                  {tooltipCopy.layerDifference}
                </div>
              {/if}
            </div>
            <span class="font-mono text-slate-300">{layerDifference}</span>
          </div>
          <input type="range" min="0" max="255" step="1" bind:value={layerDifference} class="w-full" />
        </div>
      {/if}

      <div class="mb-4 pt-3 border-t border-slate-700">
        <div class="text-slate-400 mb-2 text-sm font-medium flex items-center gap-2 relative">
          <span>Curve Fitting</span>
          <button
            type="button"
            aria-label="What does Curve Fitting do?"
            aria-expanded={activeTooltip === 'curveFitting'}
            aria-controls="tip-curveFitting"
            onclick={() => toggleTooltip('curveFitting')}
            class={tooltipButtonClass}
          >i
          </button>
          {#if activeTooltip === 'curveFitting'}
            <div id="tip-curveFitting" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
              {tooltipCopy.curveFitting}
            </div>
          {/if}
        </div>
        
        <div class="flex gap-1">
          <button 
            class="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors {pathMode === 'none' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => pathMode = 'none'}
          >Pixel</button>
          <button 
            class="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors {pathMode === 'polygon' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => pathMode = 'polygon'}
          >Polygon</button>
          <button 
            class="flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors {pathMode === 'spline' ? 'bg-[#188F54] hover:bg-[#95DB50] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => pathMode = 'spline'}
          >Spline</button>
        </div>
      </div>

      {#if showSplineOptions}
        <div class="mb-3">
          <div class="flex justify-between text-slate-400 text-sm mb-1">
            <div class="flex items-center gap-2 relative">
              <span>Corner Threshold</span>
              <button
                type="button"
                aria-label="What does Corner Threshold do?"
                aria-expanded={activeTooltip === 'cornerThreshold'}
                aria-controls="tip-cornerThreshold"
                onclick={() => toggleTooltip('cornerThreshold')}
                class={tooltipButtonClass}
              >i
              </button>
              {#if activeTooltip === 'cornerThreshold'}
                <div id="tip-cornerThreshold" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
                  {tooltipCopy.cornerThreshold}
                </div>
              {/if}
            </div>
            <span class="font-mono text-slate-300">{cornerThreshold}°</span>
          </div>
          <input type="range" min="0" max="180" step="1" bind:value={cornerThreshold} class="w-full" />
        </div>

        <div class="mb-3">
          <div class="flex justify-between text-slate-400 text-sm mb-1">
            <div class="flex items-center gap-2 relative">
              <span>Segment Length</span>
              <button
                type="button"
                aria-label="What does Segment Length do?"
                aria-expanded={activeTooltip === 'lengthThreshold'}
                aria-controls="tip-lengthThreshold"
                onclick={() => toggleTooltip('lengthThreshold')}
                class={tooltipButtonClass}
              >i
              </button>
              {#if activeTooltip === 'lengthThreshold'}
                <div id="tip-lengthThreshold" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
                  {tooltipCopy.lengthThreshold}
                </div>
              {/if}
            </div>
            <span class="font-mono text-slate-300">{lengthThreshold}</span>
          </div>
          <input type="range" min="3.5" max="10" step="0.5" bind:value={lengthThreshold} class="w-full" />
        </div>

        <div class="mb-3">
          <div class="flex justify-between text-slate-400 text-sm mb-1">
            <div class="flex items-center gap-2 relative">
              <span>Splice Threshold</span>
              <button
                type="button"
                aria-label="What does Splice Threshold do?"
                aria-expanded={activeTooltip === 'spliceThreshold'}
                aria-controls="tip-spliceThreshold"
                onclick={() => toggleTooltip('spliceThreshold')}
                class="w-5 h-5 text-[10px] font-bold rounded-full border border-emerald-700 text-emerald-300 flex items-center justify-center hover:bg-emerald-900/40"
              >i
              </button>
              {#if activeTooltip === 'spliceThreshold'}
                <div id="tip-spliceThreshold" class="absolute left-0 top-full mt-1 z-20 w-64 max-w-xs text-xs text-left bg-black/90 border border-emerald-700 rounded p-2 text-slate-100 shadow-lg">
                  {tooltipCopy.spliceThreshold}
                </div>
              {/if}
            </div>
            <span class="font-mono text-slate-300">{spliceThreshold}°</span>
          </div>
          <input type="range" min="0" max="180" step="1" bind:value={spliceThreshold} class="w-full" />
        </div>
      {/if}
      
      {#if error}
        <div class="mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">
          {error}
        </div>
      {/if}
      {#if hasImage}
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            onclick={resetImage}
            class="inline-flex items-center gap-2 rounded-md border border-emerald-700 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 transition-colors"
          >
            Clear image
          </button>
        </div>
      {/if}
      <div class="mt-4 pt-3 border-t border-emerald-800 text-xs text-emerald-500/80">
        <div class="mt-2">100% Client-Side • WASM Powered</div>
        <div class="flex gap-3 text-xs mt-2">
          <a href="https://www.visioncortex.org/vtracer-docs" target="_blank" class="text-gray-400 hover:text-white">VTracer Docs</a>
          <span class="text-gray-500"> | </span>
          <a href="https://github.com/jarettrude/vtracer-wasm" target="_blank" class="text-gray-400 hover:text-white">GitHub</a>
        </div>
      </div>
    </div>
  </aside>
</div>
