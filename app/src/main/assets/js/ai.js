// File: app/src/main/assets/js/ai.js

sys.openAI = async () => {
    window.closeAllSidebars();
    document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');

    if (sys.aiAppInstance) {
        try { sys.aiAppInstance.unmount(); } catch (e) { console.warn("AI Zombie Unmount Error (Ignored):", e); }
        sys.aiAppInstance = null;
    }

    sys.activeAppUrl = "AI_COUNCIL";
    sys.activeAppName = "AI Council";

    if (sys.enterFullscreenMode) { sys.enterFullscreenMode(); }

    if(loader) loader.style.display = 'flex';

    try {
        await sys.loadScript('js/tailwind.js', 'tw-script');
        await sys.loadScript('js/vue.js', 'vue-script');
        await sys.loadScript('js/marked.js', 'marked-script');
        await sys.loadScript('js/html2pdf.js', 'pdf-script');

        if (!nativeRoot) { console.error("Native Root missing"); throw new Error("DOM Error: Native Root not found"); }

        nativeRoot.innerHTML = `<div id="vue-app-mount" class="h-full w-full relative z-[1000]"></div>`;

        if (typeof Vue === 'undefined') { throw new Error("Vue Library failed to load. Check internet or assets."); }

        const { createApp, ref, onMounted, nextTick, watch, computed } = Vue;

        const ICONS = {
            send: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>`,
            stop: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M6 6h12v12H6z"></path></svg>`,
            play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
            gavel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M14 13l-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10m3 3l6-6c.83-.83.83-2.17 0-3 0 0 0 0 0 0a2.12 2.12 0 0 0-3 0L11 10m7 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg>`,
            chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>`,
            chess: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 3L4 12h16L12 3zm0 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path></svg>`,
            robot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4m-4 5h0m8 0h0"></path></svg>`,
            sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M12 3l1.912 5.813a2 2 0 0 1 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 1-1.275-1.275L12 21l-1.912-5.813a2 2 0 0 1-1.275-1.275L3 12l5.813-1.912a2 2 0 0 1 1.275-1.275L12 3Z"></path></svg>`,
            edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
            trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
            plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
            menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
            close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
            cog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
            alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
            pdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
            copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
            flowork: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%"><defs><linearGradient id="ai_robot_body_grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3a3962"/><stop offset="100%" stop-color="#706bf3"/></linearGradient><linearGradient id="ai_visor_grad" x1="0%" y1="50%" x2="100%" y2="50%"><stop offset="0%" stop-color="#54d7f6"/><stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#54d7f6"/></linearGradient><linearGradient id="ai_flow_arm_grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#706bf3"/><stop offset="100%" stop-color="#54d7f6"/></linearGradient><linearGradient id="ai_core_grad_chest" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#2d2f45"/><stop offset="50%" stop-color="#706bf3"/><stop offset="100%" stop-color="#54d7f6"/></linearGradient><filter id="ai_robot_glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/><feColorMatrix in="blur" mode="matrix" values="0.3 0 0 0 0  0 0.3 0 0 0  0 0 1 0 0  0 0 0 1 0" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="ai_energy_bloom"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="ai_chest_glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur" opacity="0.8"/><feMergeNode in="SourceGraphic"/></feMerge></filter><g id="ai_chest_ring_outer"><circle cx="0" cy="0" r="230" fill="none" stroke="#54d7f6" stroke-width="20" stroke-linecap="round" stroke-dasharray="200 150 50 150" opacity="0.9"></circle><animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="3s" repeatCount="indefinite"/></g><g id="ai_chest_ring_inner"><circle cx="0" cy="0" r="200" fill="none" stroke="#706bf3" stroke-width="25" stroke-linecap="round" stroke-dasharray="100 80 30 80 100 80" opacity="0.8"></circle><animateTransform attributeName="transform" type="rotate" from="360 0 0" to="0 0 0" dur="2.5s" repeatCount="indefinite"/></g></defs><g transform="translate(256, 260)"><ellipse cx="0" cy="140" rx="80" ry="20" fill="#54d7f6" opacity="0.3" filter="url(#ai_energy_bloom)"/><g filter="url(#ai_robot_glow)"><path d="M -60 40 C -70 80, -40 120, 0 130 C 40 120, 70 80, 60 40 L 40 -20 L -40 -20 Z" fill="url(#ai_robot_body_grad)"/><rect x="-30" y="-40" width="60" height="30" rx="5" fill="#2d2f45"/><path d="M -70 -40 L -80 -90 C -80 -130, -40 -150, 0 -150 C 40 -150, 80 -130, 80 -90 L 70 -40 Z" fill="url(#ai_robot_body_grad)"/><path d="M -60 -90 C -60 -110, -30 -120, 0 -120 C 30 -120, 60 -110, 60 -90 C 60 -75, 30 -85, 0 -85 C -30 -85, -60 -75, -60 -90 Z" fill="url(#ai_visor_grad)" filter="url(#ai_energy_bloom)"/></g><g transform="translate(0, 50) scale(0.15)" filter="url(#ai_chest_glow)"><use href="#ai_chest_ring_outer"/> <use href="#ai_chest_ring_inner"/><g transform="translate(-256, -256)"><path d="M100 80 L 220 80 L 220 200 L 160 200 L 160 432 L 100 432 Z" fill="url(#ai_core_grad_chest)" stroke="#3a3962" stroke-width="4"/><path d="M260 80 L 412 80 L 412 180 L 260 180 Z" fill="#54d7f6" opacity="0.9"/><path d="M260 220 L 360 220 L 360 320 L 260 320 Z" fill="#706bf3" opacity="0.9"/><path d="M220 130 L 260 130" stroke="#ffd700" stroke-width="8" stroke-linecap="round"/><path d="M220 270 L 260 270" stroke="#ffd700" stroke-width="8" stroke-linecap="round"/></g></g><g><path d="M -50 20 C -120 20, -160 -40, -180 -80" fill="none" stroke="url(#ai_flow_arm_grad)" stroke-width="12" stroke-linecap="round" filter="url(#ai_energy_bloom)"/><g transform="translate(-180, -80) rotate(-20)"><rect x="-15" y="-15" width="30" height="30" fill="none" stroke="#54d7f6" stroke-width="3"/><rect x="-8" y="-8" width="16" height="16" fill="#54d7f6" opacity="0.6"/></g></g><g><path d="M 50 20 C 120 20, 160 60, 180 100" fill="none" stroke="url(#ai_flow_arm_grad)" stroke-width="12" stroke-linecap="round" filter="url(#ai_energy_bloom)"/><g transform="translate(180, 100)"><circle cx="0" cy="0" r="18" fill="none" stroke="#706bf3" stroke-width="3"/><circle cx="0" cy="0" r="10" fill="#706bf3"/></g></g></g></svg>`
        };

        const app = createApp({
            // [UPDATE] pb-[100px] untuk mengangkat input lebih tinggi lagi (naik 20px dari sebelumnya)
            template: `
            <div :class="['flex w-full h-full relative overflow-hidden text-base font-sans transition-colors duration-300', isDark ? 'bg-[#09090b]' : 'bg-gray-50']" :style="{ fontSize: zoomLevel + 'px' }">
                <transition name="fade">
                    <div v-if="toast.show" :class="['fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[100005] px-5 py-3 rounded-full shadow-2xl border flex items-center gap-3 backdrop-blur-md w-max', toast.type === 'error' ? 'bg-red-900/90 border-red-500 text-red-100' : (isDark ? 'bg-[#1E1E20]/95 border-[#54d7f6] text-[#54d7f6]' : 'bg-white/95 border-blue-500 text-blue-600')]">
                        <span class="font-bold text-sm" v-html="toast.message"></span>
                    </div>
                </transition>
                <div v-if="modal.show === 'input'" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div :class="['border w-full max-w-sm rounded-2xl shadow-2xl p-6', isDark ? 'bg-[#1E1E20] border-[#333]' : 'bg-white border-gray-200']">
                        <h3 :class="['font-bold text-lg mb-4 font-header', isDark ? 'text-white' : 'text-gray-900']" v-html="t('ai_rename_title')"></h3>
                        <input id="rename-session-input" v-model="modal.inputValue" @keydown.enter="confirmAction" :class="['w-full border rounded-lg p-3 outline-none mb-6 text-sm', isDark ? 'bg-[#121214] border-[#333] text-white focus:border-[#54d7f6]' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500']" :placeholder="t('ai_new_title')">
                        <div class="flex justify-end gap-3">
                            <button @click="closeModal" class="px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-700/20" v-html="t('ai_cancel')"></button>
                            <button @click="confirmAction" class="px-5 py-2 rounded-lg text-xs font-bold bg-[#54d7f6] text-black" v-html="t('ai_save')"></button>
                        </div>
                    </div>
                </div>
                <div v-if="modal.show === 'confirm'" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div :class="['border w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center', isDark ? 'bg-[#1E1E20] border-[#333]' : 'bg-white border-gray-200']">
                        <div class="w-12 h-12 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center mx-auto mb-4" v-html="icons.trash"></div>
                        <h3 :class="['font-bold text-lg mb-2 font-header', isDark ? 'text-white' : 'text-gray-900']" v-html="t('ai_del_title')"></h3>
                        <p class="text-gray-400 text-sm mb-6" v-html="t('ai_del_desc')"></p>
                        <div class="flex justify-center gap-3">
                            <button @click="closeModal" class="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:bg-gray-700/20" v-html="t('ai_cancel')"></button>
                            <button @click="confirmAction" class="px-6 py-2 rounded-lg text-xs font-bold bg-red-600 text-white" v-html="t('ai_delete')"></button>
                        </div>
                    </div>
                </div>
                <div v-if="modal.show === 'apikey'" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div :class="['border w-full max-w-sm rounded-2xl shadow-2xl p-6', isDark ? 'bg-[#1E1E20] border-[#333]' : 'bg-white border-gray-200']">
                        <div class="w-12 h-12 rounded-full bg-blue-900/20 text-blue-500 flex items-center justify-center mx-auto mb-4" v-html="icons.sparkles"></div>
                        <h3 :class="['font-bold text-lg mb-2 font-header text-center', isDark ? 'text-white' : 'text-gray-900']">Setup AI Keys</h3>
                        <p class="text-gray-400 text-xs text-center mb-6">Enter your API Keys to activate the AI Council agents. Data is stored locally.</p>
                        <div class="space-y-3 mb-6">
                            <div>
                                <label class="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Gemini API Key</label>
                                <input v-model="apiKeysInput.gemini" type="password" :class="['w-full border rounded-lg p-3 text-xs outline-none font-mono transition-colors', isDark ? 'bg-[#121214] border-[#333] text-white focus:border-[#54d7f6]' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500']" placeholder="Paste Gemini Key here...">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-gray-500 mb-1 block">DeepSeek API Key</label>
                                <input v-model="apiKeysInput.deepseek" type="password" :class="['w-full border rounded-lg p-3 text-xs outline-none font-mono transition-colors', isDark ? 'bg-[#121214] border-[#333] text-white focus:border-[#54d7f6]' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500']" placeholder="Paste DeepSeek Key here...">
                            </div>
                            <div>
                                <label class="text-[10px] font-bold uppercase text-gray-500 mb-1 block">OpenAI API Key</label>
                                <input v-model="apiKeysInput.openai" type="password" :class="['w-full border rounded-lg p-3 text-xs outline-none font-mono transition-colors', isDark ? 'bg-[#121214] border-[#333] text-white focus:border-[#54d7f6]' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500']" placeholder="Paste OpenAI Key here...">
                            </div>
                        </div>
                        <div class="flex justify-end gap-3">
                            <button @click="closeModal" class="px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-700/20">Cancel</button>
                            <button @click="saveApiKeys" class="px-5 py-2 rounded-lg text-xs font-bold bg-[#54d7f6] text-black shadow-[0_0_15px_rgba(84,215,246,0.4)]">Save & Activate</button>
                        </div>
                    </div>
                </div>
                <aside :class="['w-[280px] border-r flex flex-col z-30 transition-all absolute md:relative h-full', showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0', isDark ? 'bg-[#121214] border-[#222]' : 'bg-white border-gray-200']">
                    <div :class="['p-4 border-b flex justify-between items-center shrink-0', isDark ? 'bg-[#151517] border-[#222]' : 'bg-gray-50 border-gray-200']">
                        <span :class="['text-xs font-bold tracking-widest font-header', isDark ? 'text-[#54d7f6]' : 'text-blue-600']" v-html="t('ai_archives')"></span>
                        <button @click="showSidebar = false" class="md:hidden text-gray-500" v-html="icons.close"></button>
                    </div>
                    <div class="p-3 shrink-0 flex gap-2">
                        <button @click="newSession" :disabled="isReplaying" class="flex-1 py-3 bg-blue-600/10 text-blue-400 border border-blue-600/30 rounded-lg text-xs font-bold hover:bg-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span v-html="icons.plus"></span> <span v-html="t('ai_new')"></span>
                        </button>
                    </div>
                    <div class="px-3 shrink-0 flex gap-2 mb-2">
                        <button @click="replaySession" :disabled="isReplaying || messages.length === 0" :class="['flex-1 py-2 border rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', isDark ? 'bg-[#222] text-green-400 border-[#333] hover:bg-[#333]' : 'bg-gray-100 text-green-600 border-gray-200 hover:bg-gray-200']" title="Replay Session">
                            <span v-html="icons.play"></span> <span v-html="t('ai_replay')"></span>
                        </button>
                        <button @click="exportToPDF" :disabled="isReplaying" :class="['flex-1 py-2 border rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', isDark ? 'bg-[#222] text-gray-300 border-[#333] hover:bg-[#333]' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200']" title="Export to PDF">
                            <span v-html="icons.pdf"></span> <span v-html="t('ai_pdf')"></span>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
                        <div v-for="h in history" :key="h.id" @click="!isReplaying && loadSession(h.id)"
                             :class="['group p-3 rounded-lg cursor-pointer text-xs flex items-center justify-between min-h-[48px] transition-all border border-transparent', currentId === h.id ? (isDark ? 'bg-[#1E1E20] text-white border-l-4 border-l-[#54d7f6]' : 'bg-blue-50 text-blue-900 border-l-4 border-l-blue-500') : (isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1A1A1C]' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'), isReplaying ? 'pointer-events-none opacity-50' : '']">
                            <div class="flex-1 truncate pr-2 font-medium">{{ h.title }}</div>
                            <div :class="['hidden group-hover:flex gap-1 pl-1 rounded', isDark ? 'bg-[#1A1A1C]' : 'bg-gray-100']">
                                <button @click.stop="triggerRename(h)" :class="['w-7 h-7 rounded border flex items-center justify-center transition shadow-lg', isDark ? 'bg-[#252528] text-gray-400 border-[#444] hover:bg-white hover:text-black' : 'bg-white text-gray-500 border-gray-200 hover:bg-blue-500 hover:text-white']" title="Rename" v-html="icons.edit"></button>
                                <button @click.stop="triggerDelete(h.id)" :class="['w-7 h-7 rounded border flex items-center justify-center transition shadow-lg', isDark ? 'bg-[#252528] text-gray-400 border-[#444] hover:bg-red-500 hover:text-white' : 'bg-white text-gray-500 border-gray-200 hover:bg-red-500 hover:text-white']" title="Delete" v-html="icons.trash"></button>
                            </div>
                        </div>
                    </div>
                    <div :class="['p-4 border-t shrink-0', isDark ? 'bg-[#151517] border-[#222]' : 'bg-gray-50 border-gray-200']">
                        <div class="flex justify-between text-[10px] text-gray-500 mb-2 font-bold uppercase"><span v-html="t('ai_text_size')"></span><span>{{ zoomLevel }}px</span></div>
                        <input type="range" v-model="zoomLevel" min="12" max="40" step="1" :class="['w-full h-1 rounded-lg appearance-none cursor-pointer', isDark ? 'bg-[#333] accent-[#54d7f6]' : 'bg-gray-300 accent-blue-600']">
                    </div>
                </aside>
                <main :class="['flex-1 flex flex-col relative w-full h-full', isDark ? 'bg-[#09090b]' : 'bg-white']">
                    <div :class="['h-14 border-b flex items-center justify-between px-4 md:hidden shrink-0 z-20', isDark ? 'bg-[#121214] border-[#222]' : 'bg-white border-gray-200']">
                        <button @click="showSidebar = true" class="text-gray-400" v-html="icons.menu"></button>
                        <span :class="['text-xs font-bold tracking-widest font-header', isDark ? 'text-gray-300' : 'text-gray-800']" v-html="t('ai_war_room')"></span>
                        <button @click="showConfig = !showConfig" class="text-gray-400" v-html="icons.cog"></button>
                    </div>
                    <div id="chatBox" :class="['flex-1 min-h-0 p-4 md:p-8 scroll-smooth custom-scrollbar', messages.length === 0 ? 'overflow-hidden flex flex-col items-center justify-center pb-[130px]' : 'overflow-y-auto pb-64']" :style="{ fontSize: zoomLevel + 'px', lineHeight: '1.6' }">
                        <div v-if="messages.length === 0" class="flex flex-col items-center justify-center opacity-100 text-center select-none w-full h-full">
                            <div class="w-64 h-64 md:w-full md:max-w-[500px] md:h-auto aspect-square p-4 opacity-80" v-html="icons.flowork"></div>
                            <h1 :class="['text-3xl font-black tracking-[0.2em] mt-4 font-header opacity-40', isDark ? 'text-white' : 'text-black']">FLOWORK</h1>
                        </div>
                        <div v-else class="max-w-4xl mx-auto w-full">
                            <div v-for="(msg, i) in messages" :key="i" class="mb-8 w-full group/msg relative">
                                <div v-if="msg.role === 'user'" class="flex justify-end">
                                    <div :class="['max-w-[85%] p-4 rounded-2xl rounded-tr-sm border leading-relaxed shadow-lg relative break-words', isDark ? 'bg-[#2A2A2D] text-[#E3E3E3] border-[#333]' : 'bg-blue-50 text-gray-800 border-blue-100']">
                                        {{ msg.content }}<span v-if="msg.isTyping" class="typing-cursor"></span>
                                        <button @click="copyText(msg.content)" class="absolute -left-8 top-2 text-gray-400 hover:text-gray-600 opacity-0 group-hover/msg:opacity-100 transition" title="Copy">
                                            <span v-html="icons.copy"></span>
                                        </button>
                                    </div>
                                </div>
                                <div v-else class="flex gap-4 max-w-full">
                                    <div :class="['w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-lg overflow-hidden p-1', msg.style.iconBox]" v-html="msg.style.iconSvg"></div>
                                    <div class="flex-1 min-w-0 relative w-full max-w-[85%] md:max-w-[75%]">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span :class="['font-bold', isDark ? 'text-gray-200' : 'text-gray-900']">{{ msg.name }}</span>
                                            <span :class="['text-[10px] px-2 py-0.5 rounded border uppercase font-mono tracking-wider align-middle', msg.style.badge]">{{ msg.title }}</span>
                                            <button @click="copyText(msg.content)" class="ml-auto text-gray-400 hover:text-gray-600 opacity-0 group-hover/msg:opacity-100 transition p-1" title="Copy Response">
                                                <span v-html="icons.copy"></span>
                                            </button>
                                        </div>
                                        <div :class="['p-4 md:p-5 rounded-2xl border leading-7 shadow-sm prose font-stylish w-full break-words', isDark ? 'prose-invert' : '', msg.style.box]">
                                            <div v-if="msg.isTyping" class="whitespace-pre-wrap">{{ msg.displayContent }}<span class="typing-cursor"></span></div>
                                            <div v-else v-html="renderMd(msg.content)"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="loading && (!messages.length || messages[messages.length-1].role === 'user')" class="flex justify-center mt-6">
                                <div :class="['px-5 py-2 rounded-full border flex items-center gap-3 shadow-lg', isDark ? 'bg-[#121214] border-cyan-900/30' : 'bg-white border-blue-100']">
                                    <span :class="['text-[10px] font-mono tracking-widest animate-pulse', isDark ? 'text-cyan-200' : 'text-blue-600']" v-html="t('ai_connecting')"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div :class="['absolute bottom-0 w-full px-4 pb-[120px] pt-16 z-20', isDark ? 'bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent' : 'bg-gradient-to-t from-white via-white to-transparent']">
                        <div class="max-w-3xl mx-auto relative group">
                            <div class="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-full opacity-30 group-hover:opacity-50 transition duration-500 blur-sm"></div>
                            <div :class="['relative rounded-2xl border flex items-end shadow-2xl transition-all duration-300 overflow-hidden', isDark ? 'bg-[#1E1E20] border-[#333]' : 'bg-white border-gray-200']">
                                <textarea
                                    v-model="input"
                                    @keydown.enter.prevent="handleEnter"
                                    :placeholder="isReplaying ? t('ai_placeholder_replay') : t('ai_placeholder')"
                                    :disabled="isReplaying"
                                    :class="['w-full bg-transparent p-3.5 outline-none resize-none custom-scrollbar font-stylish disabled:cursor-not-allowed', isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400']"
                                    :style="{ height: input ? '100px' : '56px', fontSize: zoomLevel > 20 ? '20px' : zoomLevel + 'px' }"
                                ></textarea>
                                <div class="pb-1.5 pr-1.5">
                                    <button
                                        @click="toggleProcess"
                                        :disabled="(!input && !loading) || isReplaying"
                                        :class="['w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(84,215,246,0.3)] transform hover:scale-105 active:scale-95 border-2',
                                        loading ? 'bg-red-500 text-white' : ((!input && !loading) || isReplaying ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-[#54d7f6] text-[#09090b] hover:bg-white')]"
                                    >
                                        <span v-if="loading" v-html="icons.stop"></span>
                                        <span v-else v-html="icons.send"></span>
                                    </button>
                                </div>
                            </div>
                            <div class="text-[9px] text-gray-600 font-mono text-center mt-2 opacity-50 hidden md:block" v-if="!isReplaying" v-html="t('ai_shift_enter')"></div>
                        </div>
                    </div>
                </main>
                <aside :class="['w-[300px] border-l flex flex-col z-30 transition-transform duration-300 absolute right-0 h-full shadow-2xl', showConfig ? 'translate-x-0' : 'translate-x-full md:translate-x-0', isDark ? 'bg-[#161618] border-[#222]' : 'bg-white border-gray-200']">
                    <div :class="['p-4 border-b flex justify-between items-center', isDark ? 'bg-[#1A1A1C] border-[#222]' : 'bg-gray-50 border-gray-200']">
                        <span :class="['text-xs font-bold tracking-widest font-header', isDark ? 'text-gray-300' : 'text-gray-800']" v-html="t('ai_config')"></span>
                        <button @click="showConfig = false" class="md:hidden text-gray-400" v-html="icons.close"></button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        <div class="space-y-2 pb-4 border-b border-[#333]">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <span v-html="icons.gavel" class="w-4 h-4 text-yellow-500"></span> <span v-html="t('ai_moderator')"></span>
                            </label>
                            <select v-model="moderatorId" :class="['w-full border text-xs rounded p-2 focus:border-yellow-500 outline-none', isDark ? 'bg-[#09090b] border-[#333] text-gray-300' : 'bg-white border-gray-300 text-gray-900']">
                                <option v-for="(meta, id) in agentMeta" :value="id">{{ meta.name }}</option>
                            </select>
                            <p class="text-[9px] text-gray-600 italic" v-html="t('ai_mod_desc')"></p>
                        </div>
                        <div v-for="(val, key) in prompts" :key="key" class="space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                    <span v-html="getRoleIconSvg(key)" class="w-4 h-4"></span> {{ agentMeta[key].name }}
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" v-model="activeAgents[key]" class="sr-only peer">
                                    <div class="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#54d7f6]"></div>
                                </label>
                            </div>
                            <textarea v-model="prompts[key]" :disabled="!activeAgents[key]" :class="['w-full border text-[11px] p-3 rounded-lg h-20 outline-none focus:border-[#54d7f6] disabled:opacity-30 resize-none font-stylish', isDark ? 'bg-[#09090b] border-[#333] text-gray-400' : 'bg-gray-50 border-gray-300 text-gray-700']"></textarea>
                        </div>
                        <button @click="saveConfig" :class="['w-full py-3 border text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2', isDark ? 'bg-[#222] border-[#333] text-gray-300 hover:bg-green-900/20 hover:text-green-400' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-green-100 hover:text-green-700']">
                            <span v-html="icons.sparkles"></span> <span v-html="t('ai_save_config')"></span>
                        </button>
                    </div>
                </aside>
            </div>
            `,
            setup() {
                const showSidebar = ref(false);
                const showConfig = ref(false);
                const input = ref('');
                const loading = ref(false);
                const isReplaying = ref(false);
                const stopSignal = ref(false);
                const messages = ref([]);
                const history = ref([]);
                const currentId = ref(Date.now());
                const zoomLevel = ref(14);
                const toast = ref({ show: false, message: '', type: 'info' });
                const modal = ref({ show: null, message: '', inputValue: '', callback: null });

                const currentTheme = ref(document.documentElement.getAttribute('data-theme') || 'dark');
                const isDark = computed(() => currentTheme.value === 'dark');

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
                            currentTheme.value = document.documentElement.getAttribute('data-theme');
                        }
                    });
                });

                onMounted(() => {
                    observer.observe(document.documentElement, { attributes: true });

                    const renderer = new marked.Renderer();
                    const textContent = (str) => {
                        return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
                    };
                    renderer.html = (html) => { return textContent(html); };
                    renderer.link = (href, title, text) => {
                        try {
                            const prot = new URL(href).protocol;
                            if (prot === 'javascript:' || prot === 'vbscript:' || prot === 'data:') { return text; }
                        } catch (e) { return text; }
                        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                    };

                    marked.setOptions({ renderer: renderer, breaks: true, gfm: true });

                    const h = localStorage.getItem('ai_council_history');
                    if(h) history.value = JSON.parse(h);

                    const p = localStorage.getItem('ai_council_prompts');
                    if(p) { try { prompts.value = JSON.parse(p); } catch(e) { } }

                    const z = localStorage.getItem('ai_council_zoom');
                    if(z) zoomLevel.value = parseInt(z);
                    const active = localStorage.getItem('ai_council_active');
                    if(active) activeAgents.value = JSON.parse(active);
                    const mod = localStorage.getItem('ai_council_moderator');
                    if(mod) moderatorId.value = mod;

                    if(history.value.length === 0) newSession();
                    else loadSession(history.value[0].id);
                });

                const t = (key) => sys.t(key);

                const agentMeta = {
                    'logic': { name: 'ChatGPT Critic', icon: 'gavel' },
                    'creative': { name: 'Gemini Analyst', icon: 'chart' },
                    'tactical': { name: 'DeepSeek Strategist', icon: 'chess' }
                };

                const activeAgents = ref({ logic: true, creative: true, tactical: true });
                const moderatorId = ref('creative');

                const prompts = ref({
                    logic: t('ai_prompt_logic'),
                    creative: t('ai_prompt_creative'),
                    tactical: t('ai_prompt_tactical')
                });

                watch(zoomLevel, (val) => localStorage.setItem('ai_council_zoom', val));
                watch(activeAgents, (val) => localStorage.setItem('ai_council_active', JSON.stringify(val)), {deep:true});
                watch(moderatorId, (val) => localStorage.setItem('ai_council_moderator', val));

                const renderMd = (txt) => { if (!txt) return ''; return marked.parse(txt); };
                const scrollBottom = () => nextTick(() => { const el = document.getElementById('chatBox'); if(el) el.scrollTop = el.scrollHeight; });
                const handleEnter = (e) => { if (!e.shiftKey) toggleProcess(); };

                const getRoleIconSvg = (key) => ICONS[agentMeta[key]?.icon || 'robot'];
                const getRoleIcon = (key) => getRoleIconSvg(key);

                const showToast = (msg, type='info') => {
                    toast.value = { show: true, message: msg, type };
                    setTimeout(() => toast.value.show = false, 3000);
                };

                const copyText = (text) => {
                    navigator.clipboard.writeText(text).then(() => { showToast(t('ai_toast_copied'), "success"); });
                };

                const exportToPDF = () => {
                    if(messages.value.length === 0) { showToast(t('ai_toast_empty'), "error"); return; }
                    showToast(t('ai_toast_pdf'), "info");

                    const element = document.createElement('div');
                    element.style.width = '100%'; element.style.boxSizing = 'border-box';

                    const coverPage = document.createElement('div');
                    coverPage.style.width = '100%'; coverPage.style.height = '1000px';
                    coverPage.style.display = 'flex'; coverPage.style.flexDirection = 'column';
                    coverPage.style.alignItems = 'center'; coverPage.style.justifyContent = 'center';
                    coverPage.style.pageBreakAfter = 'always'; coverPage.style.fontFamily = 'Helvetica, sans-serif';
                    coverPage.style.background = '#fff'; coverPage.style.color = '#171925';

                    const topicMsg = messages.value.find(m => m.role === 'user');
                    const topic = topicMsg ? topicMsg.content : "General Session";
                    const imgTag = `<img src="../../../images/logo.png" style="width:200px; height:auto; margin-bottom:40px;" />`;

                    coverPage.innerHTML = `
                        ${imgTag}
                        <h1 style="font-size: 36px; font-weight: 800; color: #171925; margin-bottom: 10px; text-transform: uppercase; text-align: center; letter-spacing: 2px;">LAPORAN HASIL<br>DEWAN AI</h1>
                        <div style="width: 100px; height: 4px; background: #54d7f6; margin: 20px auto;"></div>
                        <h2 style="font-size: 18px; font-weight: 400; color: #555; margin-bottom: 60px; text-align: center; max-width: 80%;">"${topic.substring(0, 150)}${topic.length > 150 ? '...' : ''}"</h2>
                        <div style="text-align: center; color: #888; font-size: 12px; margin-top: 50px;">
                            <p style="margin-bottom: 5px;">DIBUAT PADA:</p>
                            <p style="font-weight: bold; color: #333; margin-bottom: 20px;">${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
                            <a href="https://flowork.cloud/app/ai-counci" style="color: #54d7f6; text-decoration: none; font-weight: bold;">https://flowork.cloud/app/ai-counci</a>
                        </div>
                    `;
                    element.appendChild(coverPage);

                    const contentContainer = document.createElement('div');
                    contentContainer.style.padding = '40px'; contentContainer.style.fontFamily = 'Helvetica, sans-serif';
                    contentContainer.style.background = '#fff'; contentContainer.style.color = '#333';

                    messages.value.forEach(msg => {
                        const isUser = msg.role === 'user';
                        const roleColor = isUser ? '#2d2f45' : '#f8f9fa';
                        const textColor = isUser ? '#fff' : '#333';
                        const name = isUser ? 'COMMANDER' : msg.name.toUpperCase();
                        const msgDiv = document.createElement('div');
                        msgDiv.style.marginBottom = '25px'; msgDiv.style.pageBreakInside = 'avoid';
                        msgDiv.innerHTML = `
                            <div style="margin-bottom:5px; font-size:10px; font-weight:bold; color:#54d7f6; text-transform: uppercase; letter-spacing: 1px;">${name}</div>
                            <div style="background:${roleColor}; color:${textColor}; padding:20px; border-radius:4px; border-left: 4px solid ${isUser ? '#54d7f6' : '#ccc'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                ${marked.parse(msg.content)}
                            </div>
                        `;
                        contentContainer.appendChild(msgDiv);
                    });

                    element.appendChild(contentContainer);

                    const opt = {
                        margin: [10, 10, 20, 10], filename: `Flowork_Proposal_${Date.now()}.pdf`,
                        image: { type: 'jpeg', quality: 0.8 }, html2canvas: { scale: 1.2, useCORS: true },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    html2pdf().set(opt).from(element).outputPdf('datauristring').then(function (pdfAsString) {
                        if (typeof Android !== 'undefined' && Android.startChunkDownload) {
                            showToast("Starting Chunked Download...", "info");
                            try {
                                const base64Parts = pdfAsString.split(',');
                                const mime = base64Parts[0].match(/:(.*?);/)[1];
                                const base64Data = base64Parts[1];

                                Android.startChunkDownload(opt.filename, mime);

                                const chunkSize = 500 * 1024;
                                const totalChunks = Math.ceil(base64Data.length / chunkSize);

                                for (let i = 0; i < totalChunks; i++) {
                                    const chunk = base64Data.substr(i * chunkSize, chunkSize);
                                    Android.appendChunk(chunk);
                                }

                                Android.finishChunkDownload();
                                showToast("PDF Successfully Downloaded!", "success");
                            } catch (e) {
                                console.error(e);
                                showToast("Chunk Download Failed", "error");
                            }
                        } else {
                            const link = document.createElement('a');
                            link.href = pdfAsString;
                            link.download = opt.filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            showToast("PDF Successfully Downloaded!", "success");
                        }
                    }).catch(err => {
                        console.error(err);
                        showToast("Error generating PDF", "error");
                    });
                };

                const triggerRename = (item) => {
                    modal.value = { show: 'input', inputValue: item.title, callback: (val) => {
                        item.title = val || "Untitled"; saveHistory(); showToast(t('ai_toast_renamed'), "success");
                    }};
                    nextTick(() => document.getElementById('rename-session-input')?.focus());
                };
                const triggerDelete = (id) => {
                    modal.value = { show: 'confirm', message: t('ai_del_desc'), callback: () => {
                        history.value = history.value.filter(h => h.id !== id);
                        localStorage.setItem('ai_council_history', JSON.stringify(history.value));
                        if(history.value.length === 0) newSession();
                        else if(currentId.value === id) loadSession(history.value[0].id);
                        showToast(t('ai_toast_deleted'), "success");
                    }};
                };
                const closeModal = () => modal.value.show = null;
                const confirmAction = () => { if(modal.value.callback) modal.value.callback(modal.value.inputValue); closeModal(); };

                const saveHistory = () => {
                    if (isReplaying.value) return;
                    const idx = history.value.findIndex(h => h.id === currentId.value);
                    if(idx !== -1) {
                        history.value[idx].data = messages.value;
                        if(messages.value.length > 0 && history.value[idx].title === 'New Session') {
                            history.value[idx].title = messages.value[0].content.substring(0, 25) + '...';
                        }
                    }
                    localStorage.setItem('ai_council_history', JSON.stringify(history.value));
                };
                const newSession = () => {
                    const id = Date.now(); currentId.value = id; messages.value = [];
                    history.value.unshift({ id, title: 'New Session', data: [] });
                    saveHistory();
                    if(window.innerWidth < 768) showSidebar.value = false;
                };
                const loadSession = (id) => {
                    const s = history.value.find(h => h.id === id);
                    if(s) { currentId.value = id; messages.value = s.data || []; scrollBottom(); if(window.innerWidth < 768) showSidebar.value = false; }
                };
                const saveConfig = () => {
                    localStorage.setItem('ai_council_prompts', JSON.stringify(prompts.value));
                    showToast(t('ai_toast_config'), "success");
                };

                const toggleProcess = () => {
                    if(loading.value) {
                        stopSignal.value = true; loading.value = false;
                        messages.value.push({ role: 'ai', name: 'SYSTEM', title: t('ai_stop'), content: '_Stopped by User._', style: getStyle('system', 'stop'), isTyping: false });
                        saveHistory(); scrollBottom();
                    } else { sendMessage(); }
                };

                const simulateTyping = async (msgObj, fullText) => {
                    msgObj.isTyping = true;
                    const isUser = msgObj.role === 'user';
                    if (!isUser) msgObj.displayContent = "";
                    if (isUser) msgObj.content = "";

                    let currentText = ""; const chunkSize = 2;

                    for(let i = 0; i < fullText.length; i+=chunkSize) {
                        if(stopSignal.value && !isReplaying.value) break;
                        const chars = fullText.slice(i, i+chunkSize); currentText += chars;
                        if (isUser) { msgObj.content = currentText; } else { msgObj.displayContent = currentText; }
                        await nextTick(); scrollBottom();
                        const delay = Math.floor(Math.random() * 30) + 20;
                        await new Promise(r => setTimeout(r, delay));
                    }
                    msgObj.isTyping = false; msgObj.content = fullText;
                    if (!isReplaying.value) saveHistory();
                };

                const replaySession = async () => {
                    if(messages.value.length === 0) return;
                    isReplaying.value = true; showToast(t('ai_toast_replaying'), "info");
                    const originalMessages = JSON.parse(JSON.stringify(messages.value));
                    messages.value = [];

                    for (const msg of originalMessages) {
                        const fullContent = msg.content;
                        const newMsg = { ...msg };
                        newMsg.isTyping = true;
                        if(newMsg.role !== 'user') newMsg.displayContent = '';
                        messages.value.push(newMsg);
                        await simulateTyping(messages.value[messages.value.length - 1], fullContent);
                        await new Promise(r => setTimeout(r, 600));
                    }
                    isReplaying.value = false; showToast(t('ai_toast_replay_done'), "success");
                };

                const apiKeysInput = ref({ gemini: '', deepseek: '', openai: '' });

                const triggerApiKeySetup = () => {
                     apiKeysInput.value.gemini = localApiVault['GEMINI_API_KEY'] || '';
                     apiKeysInput.value.deepseek = localApiVault['DEEPSEEK_API_KEY'] || '';
                     apiKeysInput.value.openai = localApiVault['OPENAI_API_KEY'] || '';
                     modal.value.show = 'apikey';
                };

                const saveApiKeys = () => {
                    if(apiKeysInput.value.gemini) localApiVault['GEMINI_API_KEY'] = apiKeysInput.value.gemini;
                    if(apiKeysInput.value.deepseek) localApiVault['DEEPSEEK_API_KEY'] = apiKeysInput.value.deepseek;
                    if(apiKeysInput.value.openai) localApiVault['OPENAI_API_KEY'] = apiKeysInput.value.openai;
                    localStorage.setItem('flowork_local_vars', JSON.stringify(localApiVault));
                    showToast("API Keys Saved!", "success");
                    closeModal();
                };

                const sendMessage = async () => {
                    const txt = input.value.trim();
                    if(!txt) return;

                    const activeIds = Object.keys(activeAgents.value).filter(k => activeAgents.value[k]);
                    if (activeIds.length === 0) { showToast(t('ai_toast_need_agent'), "error"); return; }

                    const hasOpenAI = !!localApiVault['OPENAI_API_KEY'];
                    const hasGemini = !!localApiVault['GEMINI_API_KEY'];
                    const hasDeepSeek = !!localApiVault['DEEPSEEK_API_KEY'];

                    if (!hasOpenAI && !hasGemini && !hasDeepSeek) {
                        triggerApiKeySetup();
                        return;
                    }

                    if(['halo', 'test', 'p', 'cek'].includes(txt.toLowerCase())) {
                        messages.value.push({ role: 'ai', name: 'SYSTEM', title: 'BLOCKED', content: '**SYSTEM:** Jangan basa-basi.', style: getStyle('system', 'error'), isTyping: false });
                        input.value = ''; return;
                    }

                    stopSignal.value = false; input.value = '';
                    messages.value.push({ role: 'user', content: txt });
                    saveHistory(); scrollBottom(); loading.value = true;

                    try {
                        const payload = { input: txt, config: { activeIds: activeIds, prompts: prompts.value }, moderatorId: moderatorId.value };
                        const secureHeaders = await sys.getSecureApiHeaders();
                        const res = await fetch(`${BASE_URL}/api/v1/ai-counci/process`, { method: 'POST', headers: secureHeaders, body: JSON.stringify(payload) });

                        if (!res) { loading.value = false; return; }
                        const data = await res.json();
                        if (!data.success) throw new Error(data.message);

                        const results = data.data;
                        for (const item of results) {
                            if (stopSignal.value) break;
                            await new Promise(resolve => setTimeout(resolve, 600));
                            const msgObj = { role: 'ai', name: item.name, title: item.role ? item.role.toUpperCase() : 'AGENT', content: item.content, displayContent: '', isTyping: true, style: getStyle(item.id, item.role) };
                            messages.value.push(msgObj);
                            const reactiveMsg = messages.value[messages.value.length - 1];
                            await simulateTyping(reactiveMsg, item.content);
                        }
                    } catch(e) {
                        if(!stopSignal.value) messages.value.push({ role: 'ai', name: 'SYSTEM', title: t('ai_error'), content: e.message, style: getStyle('system', 'error') });
                    } finally {
                        loading.value = false; saveHistory();
                    }
                };

                const getStyle = (id, role) => {
                    const dark = isDark.value;
                    if (role === 'verdict') return { iconSvg: ICONS.flowork, iconBox: dark ? 'border-yellow-500/30 bg-black/50' : 'border-yellow-500 bg-yellow-50', box: dark ? 'border-yellow-500/40 bg-yellow-900/10 text-yellow-100' : 'border-yellow-500 bg-yellow-50 text-yellow-900', badge: 'border-yellow-500 text-yellow-600' };
                    if (role === 'error' || role === 'stop') return { iconSvg: ICONS.alert, iconBox: 'text-red-500 border-red-500', box: dark ? 'border-red-500 bg-red-900/10 text-red-200' : 'border-red-500 bg-red-50 text-red-900', badge: 'border-red-500 text-red-500' };
                    if(id === 'logic') return { iconSvg: ICONS.gavel, iconBox: dark ? 'text-red-400 border-red-500/30' : 'text-red-600 border-red-300', box: dark ? 'border-red-500/20 bg-red-900/10 text-red-100' : 'border-red-200 bg-red-50 text-red-900', badge: dark ? 'border-red-500/30 text-red-400' : 'border-red-300 text-red-600' };
                    if(id === 'creative') return { iconSvg: ICONS.chart, iconBox: dark ? 'text-blue-400 border-blue-500/30' : 'text-blue-600 border-blue-300', box: dark ? 'border-blue-500/20 bg-blue-900/10 text-blue-100' : 'border-blue-200 bg-blue-50 text-blue-900', badge: dark ? 'border-blue-500/30 text-blue-400' : 'border-blue-300 text-blue-600' };
                    if(id === 'tactical') return { iconSvg: ICONS.chess, iconBox: dark ? 'text-purple-400 border-purple-500/30' : 'text-purple-600 border-purple-300', box: dark ? 'border-purple-500/20 bg-purple-900/10 text-purple-100' : 'border-purple-200 bg-purple-50 text-purple-900', badge: dark ? 'border-purple-500/30 text-purple-400' : 'border-purple-300 text-purple-600' };
                    return { iconSvg: ICONS.robot, iconBox: dark ? 'text-gray-400' : 'text-gray-600', box: dark ? 'border-gray-700' : 'border-gray-200', badge: dark ? 'border-gray-600' : 'border-gray-300' };
                };

                return {
                    t, showSidebar, showConfig, input, loading, messages, history, currentId, prompts,
                    toast, modal, zoomLevel, activeAgents, moderatorId, agentMeta, isReplaying, icons: ICONS,
                    newSession, loadSession, triggerDelete, triggerRename, closeModal, confirmAction,
                    saveConfig, toggleProcess, handleEnter, renderMd, getRoleIconSvg, getRoleIcon,
                    exportToPDF, copyText, replaySession, isDark,
                    apiKeysInput, saveApiKeys
                };
            }
        });

        const style = document.createElement('style');
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&family=Orbitron:wght@500;700&display=swap');
            .font-stylish { font-family: 'Outfit', sans-serif; }
            .font-header { font-family: 'Orbitron', sans-serif; }
            .prose p { margin-bottom: 1.2em; line-height: 1.75; }
            .animate-fade-in { animation: fade 0.3s ease-out forwards; }
            .animate-slide-up { animation: slideUp 0.5s ease-out forwards; }
            .toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s ease; }
            .toast-slide-enter-from, .toast-slide-leave-to { transform: translateX(100%); opacity: 0; }
            .typing-cursor::after { content: '▋'; animation: blink 1s infinite; margin-left: 2px; color: inherit; opacity: 0.7; }
            @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
            [class*="bg-white"] .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; }
        `;
        document.head.appendChild(style);
        sys.aiAppInstance = app.mount('#vue-app-mount');
        if(loader) loader.style.display = 'none';

        const backBtnId = 'sys-floating-back';
        let backBtn = document.getElementById(backBtnId);
        if (backBtn) backBtn.remove();

        backBtn = document.createElement('div');
        backBtn.id = backBtnId;
        document.body.appendChild(backBtn);

        // [MODIFIKASI] Tombol Back Konsisten: Transparan, Bundar, Kecil, Mepet Bawah
        // [UPDATE] bottom: 50px (naik 40px dari sebelumnya 10px)
        backBtn.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 10px;
            width: 36px;
            height: 36px;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            border: 1px solid rgba(255,255,255,0.15);
            color: #fff;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateY(0);
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        `;

        backBtn.innerHTML = `<i class="mdi mdi-arrow-left" style="font-size: 18px;"></i>`;

        backBtn.onclick = () => {
             backBtn.style.transform = 'scale(0.9)';
             setTimeout(() => {
                 console.log("Closing AI Council & Cleaning RAM...");
                 if (sys.aiAppInstance) { try { sys.aiAppInstance.unmount(); } catch(e) { console.error("Error unmounting AI app:", e); } sys.aiAppInstance = null; }
                 if(nativeRoot) nativeRoot.innerHTML = '';
                 backBtn.remove();
                 sys.goHome();
             }, 150);
        };

    } catch (e) {
        console.error("Gagal load AI Council:", e);
        if(loader) loader.style.display = 'none';
        sys.toast("Error System AI");
    }
};