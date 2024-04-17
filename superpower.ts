// Global settings
module superpower_settings {
	export const increase_zoom_levels  = true;
	export const increase_zoom_levels_count = 128;

	export const spectrum_fluidity = true;
	export const spectrum_fluidity_refresh_time = 30; // in ms

	export const spectrum_enlarge = true;
	export const spectrum_enlarge_height = 200; // in px
	export const spectrum_enlarge_resizable = true; // experimental

	export const frequency_change = true;
	export const gain_change = true;

	export const waterfall_refreshing = false; // experimental
	export const profile_memory = false; // experimental
}

// JQuery extensions
interface JQuery {
	onClassChange: (callback: (node: JQuery<Node>, class_name: string) => void) => JQuery<HTMLElement>,
	onResize: (callback: (node: JQuery<Node>) => void) => JQuery<HTMLElement>,
	isEventBound: <Args extends any[], Ret>(type: string, fn: (...args: Args) => Ret) => boolean,
}

$.fn.onClassChange = function(callback: (node: JQuery<Node>, class_name: string) => void): JQuery<HTMLElement> {
	return $(this).each(({}, element) => {
		new MutationObserver(mutations => {
			mutations.forEach((mutation) => {
				callback($(mutation.target), (mutation.target as HTMLElement).className);
			});
		}).observe(element, {
			attributes: true,
			attributeFilter: ['class']
		});
	});
}

$.fn.onResize = function(callback: (node: JQuery<Node>) => void): JQuery<HTMLElement> {
	return $(this).each(({}, element) => {
		new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				callback($(entry.target));
			});
		}).observe(element);
	});
}

$.fn.isEventBound = function<Args extends any[], Ret>(type: string, fn: (...args: Args) => Ret) {
	const data = this.data('events')?.[type];

	if (data === undefined || data.length === 0) {
		return false;
	}

	return $.inArray(fn, data) !== -1;
};

// Utilities
function waitFor(predicate: () => boolean, callback: () => void, delay: number = 100): void {
	const timer = setInterval(() => {
		if (predicate()) {
			clearInterval(timer);
			callback();
		}
	}, delay);
}

function debounce<Args extends any[]>(threshold: number, callback: (...args: Args) => void): (...args: Args) => void {
	let timer: number | undefined;
	return (...args: Args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			callback(...args);
		}, threshold);
	};
}

// SDR profile related stuff
interface SdrProfile {
	readonly device: string,
	readonly id: string,
}

function isProfileUnlocked(sdr_profile: SdrProfile): boolean {
	return sdr_profile.id.toLowerCase().startsWith('unlocked');
}

function getSelectedProfile(): SdrProfile | undefined {
	const value = $('#openwebrx-sdr-profiles-listbox')?.val() as string;
	const desc = value?.split('|');
	if (desc === undefined || desc[0] === undefined || desc[1] === undefined) {
		return undefined;
	}
	return {
		device: desc[0],
		id: desc[1],
	};
}

// SDR settings related stuff
interface SdrSetting {
	readonly name: string,
	readonly value: string,
}

async function readSettings(sdr_profile: SdrProfile): Promise<SdrSetting[] | undefined> {
	if (!isProfileUnlocked(sdr_profile)) {
		return undefined;
	}

	// FIXME: This is a hack for newer versions of OpenWebRX
	const fix_exponents = (settings: SdrSetting[]) => {
		return settings.map((setting) => {
			if (setting.name.endsWith('-exponent')) {
				return {
					name: setting.name,
					value: '0',
				}
			}
			return setting;
		});
	}

	try {
		const doc: Document = await $.ajax({
			url: `settings/sdr/${sdr_profile.device}/profile/${sdr_profile.id}`,
			type: 'GET',
			xhrFields: {
				withCredentials: true
			},
		});
		return fix_exponents($(doc).find('form.settings-body').serializeArray());
	} catch (_err) {
		return undefined;
	}
}

async function writeSettings(sdr_profile: SdrProfile, settings: SdrSetting[]): Promise<SdrSetting[] | undefined> {
	if (!isProfileUnlocked(sdr_profile)) {
		return undefined;
	}

	const current_settings = await readSettings(sdr_profile);
	if (current_settings === undefined) {
		return undefined;
	}

	const combine_settings = (existing_settings: SdrSetting[], settings: SdrSetting[]): SdrSetting[] => {
		return existing_settings.map((existing_setting): SdrSetting => {
			const setting = getSettingByName(settings, existing_setting.name);
			if (setting !== undefined) {
				return setting;
			}
			return existing_setting;
		});
	};

	// Preserve existing settings
	const data = combine_settings(current_settings, settings);

	// Save data to profile "Unlocked" with POST query
	try {
		await $.ajax({
			url: `settings/sdr/${sdr_profile.device}/profile/${sdr_profile.id}`,
			type: 'POST',
			data: $.param(data),
			xhrFields: {
				withCredentials: true
			},
		});

		return await readSettings(sdr_profile);
	} catch (_err) {
		return undefined;
	}
}

function getSettingByName(settings: SdrSetting[], name: string): SdrSetting | undefined {
	return settings.find((setting) => setting.name === name);
}

// Frequency/gain range stuff
interface SdrFreqRange {
	readonly min: ManualFreq,
	readonly max: ManualFreq,
}

function getSdrFreqRange(sdr_profile: SdrProfile): SdrFreqRange | undefined {
	const sdr_freq_range: { [key: string]: SdrFreqRange } = {
		'airspy':  { min: { exp: 0, value: 1 }, max: { exp: 9, value: 1.8 } },
		'rtlsdr':  { min: { exp: 0, value: 1 }, max: { exp: 9, value: 2.2 } },
		'sdrplay': { min: { exp: 0, value: 1 }, max: { exp: 9, value: 2.0 } },
	};
	return sdr_freq_range[sdr_profile.device];
}

function rangeMidpoint(range: SdrFreqRange | SdrGainRange): number {
	return Math.floor((range.max.value - range.min.value) / 2);
}

interface SdrGainRange {
	readonly min: ManualGain,
	readonly max: ManualGain,
	readonly step: number,
	readonly reversed: boolean,
}

function getSdrGainRange(sdr_profile: SdrProfile): SdrGainRange | undefined {
	const sdr_gain_range: { [key: string]: SdrGainRange } = {
		'airspy':  { min: { value:  0.0 }, max: { value: 45.0 }, step: 0.1, reversed: false },
		'rtlsdr':  { min: { value:  0.0 }, max: { value: 49.6 }, step: 0.1, reversed: false },
		'sdrplay': { min: { value: 20.0 }, max: { value: 59.0 }, step: 1.0, reversed: true },
	};
	return sdr_gain_range[sdr_profile.device];
}

function getSdrSecondaryGainRange(sdr_profile: SdrProfile): SdrGainRange | undefined {
	const sdr_secondary_gain_range: { [key: string]: SdrGainRange } = {
		'sdrplay': { min: { value: 0.0 }, max: { value: 3.0 }, step: 1.0, reversed: true },
	};
	return sdr_secondary_gain_range[sdr_profile.device];
}

function isGainInRange(gain_range: SdrGainRange, gain: ManualGain): boolean {
	return gain.value >= gain_range.min.value && gain.value <= gain_range.max.value;
}

function clampGainToRange(range: SdrGainRange, gain: ManualGain): ManualGain {
	return { value: Math.min(Math.max(gain.value, range.min.value), range.max.value) };
}

// Frequency related stuff
interface ManualFreq {
	readonly exp: number,
	readonly value: number,
}

type JumpFreq =
	{ readonly type: 'prev' } |
	{ readonly type: 'next' } |
	({ readonly type: 'value' } & ManualFreq);

function isFreqInRange(freq_range: SdrFreqRange, freq: ManualFreq): boolean {
	const freq_value = freqIntoNumber(freq);
	return freq_value >= freqIntoNumber(freq_range.min) && freq_value <= freqIntoNumber(freq_range.max);
}

function clampFreqToRange(range: SdrFreqRange, freq: ManualFreq): ManualFreq {
	return { exp: 0, value: Math.min(Math.max(freqIntoNumber(freq), freqIntoNumber(range.min)), freqIntoNumber(range.max)) };
}

function freqIntoNumber(freq: ManualFreq): number {
	return freq.value * Math.pow(10, freq.exp);
}

async function setFrequency(jump_freq: JumpFreq): Promise<void | undefined> {
	const sdr_profile = getSelectedProfile();
	if (sdr_profile === undefined) {
		return undefined;
	}

	const freq_range = getSdrFreqRange(sdr_profile);
	if (freq_range === undefined) {
		return undefined;
	}

	const freq_decoded = ((): ManualFreq | undefined => {
		if (jump_freq.type === 'value') {
			if (Number.isNaN(jump_freq.exp) || Number.isNaN(jump_freq.value)) {
				return undefined;
			}
			return jump_freq;
		}
		const visible_freq_range = get_visible_freq_range();
		const freq_width = visible_freq_range.end - visible_freq_range.start;

		switch (jump_freq.type) {
			case 'prev': return { exp: 0, value: visible_freq_range.center - freq_width };
			case 'next': return { exp: 0, value: visible_freq_range.center + freq_width };
		}
	})();

	if (freq_decoded === undefined) {
		return undefined;
	}

	const freq_new = clampFreqToRange(freq_range, freq_decoded);

	// Preserve current primary/secondary demodulator
	const freq_mod = getCurrentDemodulator();

	await writeSettings(sdr_profile, [
		{ name: 'center_freq', value: `${freq_new.value}` },
		{ name: 'center_freq-exponent', value: `${freq_new.exp}` },
		{ name: 'start_mod', value: `${freq_mod}` },
	]);

	updateDisplayedWaterfall();
	updateDisplayedZoomLevel();
}

// Gain related stuff
interface AutoGain {}

interface ManualGain {
	readonly value: number,
}

type Gain = ({ readonly type: 'auto' } & AutoGain) | ({ readonly type: 'manual' } & ManualGain);

function getCurrentGain(): Gain | undefined {
	const $gain_level = $('#gain-level');
	if ($gain_level === undefined) {
		return undefined;
	}

	const is_mode_manual = !$gain_level.prop('disabled');

	if (is_mode_manual) {
		const value = Number($gain_level.val());
		if (value === undefined || Number.isNaN(value)) {
			return undefined;
		}
		return {
			type: 'manual',
			value: Number(value.toFixed(1)),
		}
	} else {
		return {
			type: 'auto',
		}
	}
}

function getGainFromSettings(settings: SdrSetting[]): Gain | undefined {
	const value = getSettingByName(settings, 'rf_gain-select')?.value;
	switch (value) {
		case 'manual': {
			const value = Number(getSettingByName(settings, 'rf_gain-manual')?.value);
			if (value === undefined || Number.isNaN(value)) {
				return undefined;
			}
			return {
				type: 'manual',
				value: Number(value.toFixed(1)),
			}
		}
		case 'auto': {
			return {
				type: 'auto',
			}
		}
	}
	return undefined;
}

function getSecondaryGainFromSettings(settings: SdrSetting[]): ManualGain | undefined {
	const value = Number(getSettingByName(settings, 'rfgain_sel')?.value);
	if (value === undefined || Number.isNaN(value)) {
		return undefined;
	}
	return { value: Number(value.toFixed(1)) }
}

async function setGain(gain: Gain): Promise<void | undefined> {
	const sdr_profile = getSelectedProfile();
	if (sdr_profile === undefined) {
		return undefined;
	}

	if (gain.type === 'auto') {
		// Save auto gain to profile "Unlocked"
		const sdr_settings = await writeSettings(sdr_profile, [
			{ name: 'rf_gain-select', value: 'auto'}
		]);

		if (sdr_settings !== undefined) {
			await updateDisplayedGain(sdr_profile, sdr_settings);
		}

		return;
	}

	const gain_range = getSdrGainRange(sdr_profile);
	if (gain_range === undefined || Number.isNaN(gain.value)) {
		return undefined;
	}

	const gain_new = clampGainToRange(gain_range, { value: Number(gain.value.toFixed(1)) });

	// Save new gain to profile "Unlocked"
	const sdr_settings = await writeSettings(sdr_profile, [
		{ name: 'rf_gain-select', value: 'manual' },
		{ name: 'rf_gain-manual', value: `${gain_new.value}` }
	]);

	if (sdr_settings !== undefined) {
		await updateDisplayedGain(sdr_profile, sdr_settings);
	}
}

async function setSecondaryGain(gain: ManualGain): Promise<void | undefined> {
	const sdr_profile = getSelectedProfile();
	if (sdr_profile === undefined) {
		return undefined;
	}

	const secondary_gain_range = getSdrSecondaryGainRange(sdr_profile);
	if (secondary_gain_range === undefined || Number.isNaN(gain.value)) {
		return undefined;
	}

	const gain_new = clampGainToRange(secondary_gain_range, { value: Number(gain.value.toFixed(1)) });

	// Save new gain to profile "Unlocked"
	const sdr_settings = await writeSettings(sdr_profile, [
		{ name: 'rfgain_sel', value: `${gain_new.value}` }
	]);

	if (sdr_settings !== undefined) {
		await updateDisplayedSecondaryGain(sdr_profile, sdr_settings);
	}
}

async function toggleGainMode(): Promise<void | undefined> {
	const current_gain = getCurrentGain();

	if (current_gain === undefined) {
		return undefined;
	}

	const $gain_level = $('#gain-level');

	const [disable_attr, gain_value] = ((): [boolean, Gain] => {
		switch (current_gain.type) {
			case 'auto': return [false, { type: 'manual', value: Number($gain_level.val() as string) }];
			case 'manual': return [true, { type: 'auto' }];
		}
	})();

	$gain_level.prop('disabled', disable_attr);
	return await setGain(gain_value);
}

// Demodulator related stuff
function getCurrentDemodulator(): string {
	const demodulator = getDemodulators()?.[0];
	if (demodulator === undefined) {
		return 'nfm';
	}
	const secondary_demod = demodulator.get_secondary_demod();
	if (secondary_demod !== false) {
		return secondary_demod;
	}
	return demodulator.get_modulation();
}

// Displayed elements/values related stuff
function updateDisplayedWaterfall(): void {
	if (!superpower_settings.waterfall_refreshing) {
		return;
	}

	waterfall_measure_minmax_now = true;
}

function updateDisplayedZoomLevel(): void {
	if (!superpower_settings.increase_zoom_levels) {
		return;
	}

	// Smoother zooming
	zoom_levels_count = superpower_settings.increase_zoom_levels_count;
	mkzoomlevels();
}

async function updateDisplayedGain(sdr_profile: SdrProfile, sdr_settings: SdrSetting[]): Promise<void | undefined> {
	const gain_range = getSdrGainRange(sdr_profile);
	if (gain_range === undefined) {
		return undefined;
	}

	const settings_gain = getGainFromSettings(sdr_settings);
	if (settings_gain === undefined) {
		return undefined;
	}

	switch (settings_gain.type) {
		case 'auto': {
			$('#gain-mode')
				.html(`Gain: auto`)
				.prop('title', 'Gain (auto)');
			$('#gain-level')
				.prop('title', `Gain (auto)`)
				.prop('disabled', true);
			break;
		}
		case 'manual': {
			const gain_value = settings_gain.value;
			const displayed_gain = gain_range.reversed ? -gain_value : gain_value;

			$('#gain-mode')
				.html(`Gain: ${displayed_gain}dB`)
				.prop('title', `Gain (${displayed_gain}dB)`);
			$('#gain-level')
				.prop('title', `Gain (${displayed_gain}dB)`)
				.prop('value', gain_value)
				.prop('disabled', false);
			break;
		}
	}
}

async function updateDisplayedSecondaryGain(sdr_profile: SdrProfile, sdr_settings: SdrSetting[]): Promise<void | undefined> {
	const secondary_gain_range = getSdrSecondaryGainRange(sdr_profile);
	if (secondary_gain_range === undefined) {
		return undefined;
	}

	const settings_secondary_gain = getSecondaryGainFromSettings(sdr_settings);
	if (settings_secondary_gain === undefined) {
		return undefined;
	}

	const secondary_gain_value = settings_secondary_gain.value;
	const displayed_secondary_gain = secondary_gain_range.reversed ? -secondary_gain_value : secondary_gain_value;

	$('#secondary-gain-level')
		.prop('title', `Secondary gain (${displayed_secondary_gain}dB)`)
		.prop('value', secondary_gain_value);
}

async function updateDisplayedGainRange(sdr_profile: SdrProfile, sdr_settings: SdrSetting[]): Promise<void | undefined> {
	const gain_range = getSdrGainRange(sdr_profile);
	if (gain_range === undefined) {
		return undefined;
	}

	const $gain_level = $('#gain-level');

	$gain_level.prop({
		'min': gain_range.min.value,
		'max': gain_range.max.value,
		'step': gain_range.step,
	});

	if (!gain_range.reversed) {
		$gain_level.css({ 'transform': '' });
		$gain_level.off('wheel');
	} else {
		$gain_level.css({ 'transform': 'rotate(180deg)' });
		$gain_level.off('wheel');
		$gain_level.on('wheel', (event) => {
			const gain = clampGainToRange(gain_range, {
				value: (() => {
					const value = Number($gain_level.val() as string);
					const step = Number($gain_level.prop('step'));
					if ((event.originalEvent as WheelEvent).deltaY > 0) {
						return value + step;
					} else {
						return value - step;
					}
				})(),
			});

			$gain_level.prop('value', gain.value);
			$gain_level.trigger('change');

			event.preventDefault();
			event.stopPropagation();
		});
	}

	const settings_gain = getGainFromSettings(sdr_settings);
	if (settings_gain === undefined) {
		return undefined;
	}

	const gain_value = (() => {
		switch (settings_gain.type) {
			case 'auto': return rangeMidpoint(gain_range);
			case 'manual': return settings_gain.value;
		}
	})();

	$gain_level.prop('value', gain_value);
}

async function updateDisplayedSecondaryGainRange(sdr_profile: SdrProfile, sdr_settings: SdrSetting[]): Promise<void | undefined> {
	const $secondary_gain_level = $('#secondary-gain-level');

	const secondary_gain_range = getSdrSecondaryGainRange(sdr_profile);
	if (secondary_gain_range === undefined) {
		$secondary_gain_level.hide();
		$secondary_gain_level.prop('disabled', true);
		return undefined;
	}

	$secondary_gain_level.show();
	$secondary_gain_level.prop('disabled', false);
	$secondary_gain_level.prop({
		'min': secondary_gain_range.min.value,
		'max': secondary_gain_range.max.value,
		'step': secondary_gain_range.step,
	});

	if (!secondary_gain_range.reversed) {
		$secondary_gain_level.css({ 'transform': '' });
		$secondary_gain_level.off('wheel');
	} else {
		$secondary_gain_level.css({ 'transform': 'rotate(180deg)' });
		$secondary_gain_level.off('wheel');
		$secondary_gain_level.on('wheel', (event) => {
			const secondary_gain = clampGainToRange(secondary_gain_range, {
				value: (() => {
					const value = Number($secondary_gain_level.val() as string);
					const step = Number($secondary_gain_level.prop('step'));
					if ((event.originalEvent as WheelEvent).deltaY > 0) {
						return value + step;
					} else {
						return value - step;
					}
				})(),
			});

			$secondary_gain_level.prop('value', secondary_gain.value);
			$secondary_gain_level.trigger('change');

			event.preventDefault();
			event.stopPropagation();
		});
	}

	const settings_secondary_gain = getSecondaryGainFromSettings(sdr_settings);
	if (settings_secondary_gain === undefined) {
		return undefined;
	}

	const gain_value = settings_secondary_gain.value;
	$secondary_gain_level.prop('value', gain_value);
}

async function updateDisplay(sdr_profile: SdrProfile, sdr_settings: SdrSetting[]): Promise<void | undefined> {
	await updateDisplayedGain(sdr_profile, sdr_settings);
	await updateDisplayedSecondaryGain(sdr_profile, sdr_settings);
	await updateDisplayedGainRange(sdr_profile, sdr_settings);
	await updateDisplayedSecondaryGainRange(sdr_profile, sdr_settings);

	updateDisplayedWaterfall();
	updateDisplayedZoomLevel();
}

// New functionality/elements related stuff
function fluidizeSpectrum(): void {
	if (!superpower_settings.spectrum_fluidity) {
		return;
	}
	// Replace instance of spectrum to improve fps
	const canvas = $('#openwebrx-spectrum-canvas')?.[0];
	if (canvas === undefined) {
		return undefined;
	}
	spectrum = undefined;
	spectrum = new Spectrum(canvas, superpower_settings.spectrum_fluidity_refresh_time);
}

function resizeSpectrum(): void {
	if (!superpower_settings.spectrum_enlarge) {
		return;
	}

	// Change height of spectrum and remove background image and add event on hide/show spectrum
	const $frequency_container = $('#openwebrx-frequency-container');
	const $spectrum_container = $('.openwebrx-spectrum-container');

	$frequency_container.css({
		'background-image': 'none',
	});

	let spectrum_height = (() => {
		if (superpower_settings.spectrum_enlarge_height !== undefined) {
			return `${superpower_settings.spectrum_enlarge_height}px`;
		} else {
			return `${$spectrum_container.height()!}px`;
		}
	})();

	$spectrum_container.onClassChange(($spectrum_container) => {
		const height = (() => {
			if ($spectrum_container.hasClass('expanded')) {
				return spectrum_height;
			} else {
				return '';
			}
		})();
		$spectrum_container.css({
			'maxHeight': height,
			'height': height,
		});
	});

	if (!superpower_settings.spectrum_enlarge_resizable) {
		return;
	}

	$spectrum_container.css({
		'resize': 'vertical'
	});

	// Crude way to implement resizing. Current #openwebrx-frequency-container mousemove event ruines standard resizing.
	let spectrum_resizing = false;

	$spectrum_container.on('mousemove', (event) => {
		if (!spectrum_resizing) {
			return;
		}

		const bounds = event.target.getBoundingClientRect();
		spectrum_height = `${event.clientY - bounds.top}px`;

		$spectrum_container.css({
			'maxHeight': spectrum_height,
			'height': spectrum_height,
		});
	}).on('mousedown', (event) => {
		const bounds = event.target.getBoundingClientRect();
		const edge_margin = 20;
		if (bounds.right - event.clientX < edge_margin && bounds.bottom - event.clientY < edge_margin) {
			spectrum_resizing = true;
		}
	}).on('mouseup', () => {
		spectrum_resizing = false;
	});
}

function modifySpectrum(): void {
	fluidizeSpectrum();
	resizeSpectrum();
}

function addProfileMemory(): void {
	if (!superpower_settings.profile_memory) {
		return;
	}

	const $profiles_listbox = $('#openwebrx-sdr-profiles-listbox');
	const last_profile_item_key = 'openwebrx-last-profile';
	const last_profile = localStorage.getItem(last_profile_item_key);

	if (last_profile !== null) {
		if ($profiles_listbox.find(`option[value='${last_profile}']`)?.length === 0) {
			localStorage.removeItem(last_profile_item_key);
		} else {
			$profiles_listbox.val(last_profile).trigger('change');
		}
	}

	$profiles_listbox.on('change', () => {
		const sdr_profile = getSelectedProfile();
		if (sdr_profile === undefined) {
			localStorage.removeItem(last_profile_item_key);
		} else {
			localStorage.setItem(last_profile_item_key, `${sdr_profile.device}|${sdr_profile.id}`);
		}
	});
}

function addFrequencyChange(): void {
	if (!superpower_settings.frequency_change) {
		return;
	}

	// Place jump arrow DIVs
	const $frequencies_div = $('.frequencies-container');
	$frequencies_div.prepend('<div id="freq-jump-prev" class="openwebrx-button"><</div>');
	$frequencies_div.append('<div id="freq-jump-next" class="openwebrx-button">></div>');

	$('#freq-jump-prev').on('click', async () => {
		await setFrequency({ type: 'prev' });
	});
	$('#freq-jump-next').on('click', async () => {
		await setFrequency({ type: 'next' });
	});

	// Add change event on freq input element
	const $panel_receiver = $('#openwebrx-panel-receiver');
	$panel_receiver.find('.input-group > input').on('change', async (event) => {
		const input_exp = $panel_receiver.find('.input-group > select').val() as string;
		const input_freq = $(event.target).val() as string;
		const freq: JumpFreq = {
			type: 'value',
			exp: Number(input_exp.length !== 0 ? input_exp : NaN),
			value: Number(input_freq.length !== 0 ? input_freq : NaN),
		};
		await setFrequency(freq);
	});

	onProfileChangeEvent((sdr_profile: SdrProfile, sdr_settings?: SdrSetting[]) => {
		if (!isProfileUnlocked(sdr_profile) || sdr_settings === undefined) {
			$('#freq-jump-prev').hide();
			$('#freq-jump-next').hide();
		} else {
			$('#freq-jump-prev').show();
			$('#freq-jump-next').show();
		}
	});
}

async function addGainChange(sdr_profile: SdrProfile): Promise<void> {
	if (!superpower_settings.gain_change) {
		return;
	}

	// Place gain title and slider
	$('#openwebrx-section-modes').before(`\
		<div id="openwebrx-section-gain" class="openwebrx-section-divider" onclick="UI.toggleSection(this);">▾ Gain</div>
		<div class="openwebrx-section">
			<div class="openwebrx-panel-line" style="display: flex;"> \
				<div id="gain-mode" class="openwebrx-button openwebrx-slider-button" title="Gain mode" style="font-size: 9pt">Gain: --.-</div> \
				<input id="gain-level" class="openwebrx-panel-slider" title="Gain" type="range" style="flex-grow: 1" disabled="" /> \
				<input id="secondary-gain-level" class="openwebrx-panel-slider" title="Secondary gain" type="range" style="width: 24px" disabled="" />
			</div>
		</div>`
	);

	const $gain_mode = $('#gain-mode');
	const $gain_level = $('#gain-level');
	const $secondary_gain_level = $('#secondary-gain-level');

	// Add click event on gain mode toggle button
	$gain_mode.on('click', async () => {
		await toggleGainMode();
	});

	// Add input/change event on gain level slider
	const sdr_settings = await readSettings(sdr_profile);
	if (sdr_settings !== undefined) {
		$gain_level.prop('disabled', false);
	}

	const gain_set_debounce_time = 80; // in ms

	$gain_level.on('input change',
		debounce(gain_set_debounce_time, async (gain: Gain) => {
			await setGain(gain);
		}),
		(event) => {
			event.data({ type: 'manual', value: Number($(event.target).val() as string) });
		}
	);

	$secondary_gain_level.hide();
	$secondary_gain_level.on('input change',
		debounce(gain_set_debounce_time, async (gain: ManualGain) => {
			await setSecondaryGain(gain)
		}),
		(event) => {
			event.data({ value: Number($(event.target).val() as string) });
		}
	);

	onProfileChangeEvent((sdr_profile: SdrProfile, sdr_settings?: SdrSetting[]) => {
		const $section_gain = $('#openwebrx-section-gain');
		if (!isProfileUnlocked(sdr_profile) || sdr_settings === undefined) {
			$section_gain.hide();
			$section_gain.next('.openwebrx-section:first').hide();
		} else {
			$section_gain.show();
			$section_gain.next('.openwebrx-section:first').show();
		}
	});
}

function onProfileChangeEvent(callback: (sdr_profile: SdrProfile, sdr_settings?: SdrSetting[]) => void) {
	$(document).on('event:superpower_sdr_profile_changed',
		({}, sdr_profile: SdrProfile, sdr_settings?: SdrSetting[]) => {
			callback(sdr_profile, sdr_settings);
		});
}

async function triggerProfileChangeEvent(): Promise<void | undefined> {
	const sdr_profile = getSelectedProfile();
	if (sdr_profile !== undefined) {
		const sdr_settings = await readSettings(sdr_profile);
		$(document).trigger('event:superpower_sdr_profile_changed', [sdr_profile, sdr_settings]);
	}
}

$(document).on('DOMContentLoaded', (): void => {
	waitFor(() => 'spectrum' in window && spectrum !== undefined, () => {
		modifySpectrum();
	});

	waitFor(() => getSelectedProfile() !== undefined, async (): Promise<void | undefined> => {
		const sdr_profile = getSelectedProfile();
		if (sdr_profile === undefined) {
			return undefined;
		}

		$('#openwebrx-sdr-profiles-listbox').on('change', async (): Promise<void | undefined> => {
			await triggerProfileChangeEvent();
		});

		addProfileMemory();
		addFrequencyChange();
		await addGainChange(sdr_profile);

		onProfileChangeEvent((sdr_profile, sdr_settings) => {
			if (sdr_settings !== undefined) {
				updateDisplay(sdr_profile, sdr_settings);
			}
		})

		await triggerProfileChangeEvent();
	});
});